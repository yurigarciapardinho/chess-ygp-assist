import { legalMove } from '../src/core/position.js';
import { squareCenter } from '../src/core/geometry.js';
import { registerBridge } from './control-bridge.mjs';
export const allowed=frame=>{try{const u=new URL(frame.url());return u.protocol==='https:'&&u.hostname==='www.flyordie.com';}catch{return false;}};
const diag=frame=>frame.evaluate('mw:window.YGPAssist?.diagnostics()');
const snapshot=frame=>frame.evaluate('mw:window.YGPAssist?.getSnapshot()');
const busy=new WeakSet();
async function unobstructed(frame,operation){
  const hidden=await frame.evaluate('mw:window.YGPAssist.setPanelHidden(true)');
  try{return await operation();}
  finally{await frame.evaluate('mw:window.YGPAssist?.setPanelHidden('+JSON.stringify(hidden)+')').catch(()=>{});}
}
async function paintAfterWheel(page,frame,point,delta){
  await page.mouse.move(point.x,point.y);
  const before=await diag(frame);
  await page.mouse.wheel(0,delta);
  const deadline=Date.now()+700;
  let previous='',stable=0,value;
  while(Date.now()<deadline){
    value=await diag(frame);
    const now=JSON.stringify(value?.visible);
    if(now&&now!==JSON.stringify(before?.visible)){
      if(now===previous)stable++;else stable=0;
      if(stable>=2)return value;
    }
    previous=now;
    await new Promise(r=>setTimeout(r,35));
  }
  return value||before;
}
export async function harvest(page,frame){
 return unobstructed(frame,async()=>{
  await frame.evaluate('mw:window.YGPAssist.beginHarvest()');
  let data=await diag(frame);
  if(data?.available&&(data.initial||data.shortHistory)&&data.complete){
    if(!await frame.evaluate('mw:window.YGPAssist.confirmTail()'))throw new Error('Posição inicial ainda não confirmada');
    return {rows:data.rows,plies:data.plies,complete:true};
  }
  if(!data?.point)throw new Error('Abra o tabuleiro e aguarde o desenho do histórico');
  for(let step=0;step<180;step++){
    if(data.visible?.[0]===1)break;
    const old=JSON.stringify(data.visible);
    data=await paintAfterWheel(page,frame,data.point,-80);
    if(step>2&&old===JSON.stringify(data.visible)&&data.visible?.[0]!==1)throw new Error('Não foi possível chegar ao primeiro lance');
  }
  if(data.visible?.[0]!==1)throw new Error('Histórico excede o limite de recuperação');
  let stable=0;
  for(let step=0;step<180;step++){
    const old=JSON.stringify(data.visible);
    data=await paintAfterWheel(page,frame,data.point,80);
    stable=old===JSON.stringify(data.visible)?stable+1:0;
    if(stable>=2)break;
  }
  if(!data.complete||!data.visible?.includes(data.last))throw new Error('Histórico incompleto; nenhum estado será presumido');
  const confirmed=await frame.evaluate('mw:window.YGPAssist.confirmTail()');
  if(!confirmed)throw new Error('Não foi possível validar o histórico recuperado');
  return {rows:data.rows,plies:data.plies,complete:true};
 });
}
export async function registerControls(context){
await context.exposeBinding('__YGPRequest',async(source,request)=>{
  if(!allowed(source.frame)||!request||typeof request!=='object')throw new Error('Origem inválida');
  if(busy.has(source.page))throw new Error('Aguarde a operação atual');
  busy.add(source.page);
  try{
    if(request.type==='harvest')return await harvest(source.page,source.frame);
    if(request.type!=='playMove')throw new Error('Operação inválida');
    const current=await snapshot(source.frame);
    if(!current?.complete||!current.active||!current.orientationVerified||current.gameId!==request.gameId||current.fen!==request.fen||current.myColor!==current.fen.split(' ')[1])throw new Error('Posição ou vez do jogador mudou');
    const move=legalMove(current.fen,request.move);
    if(!move)throw new Error('Lance ilegal');
    if(move.promotion)throw new Error('Promoção requer seleção manual no cliente nativo');
    const rect=await source.frame.evaluate('mw:window.YGPAssist.getGeometry()');
    if(!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k]))||rect.width<80||rect.height<80)throw new Error('Geometria não confirmada');
    const from=squareCenter(move.from,rect,current.orientation),to=squareCenter(move.to,rect,current.orientation);
    const viewport=source.page.viewportSize()||await source.page.mainFrame().evaluate('({width:innerWidth,height:innerHeight})');
    if([from,to].some(p=>p.x<0||p.y<0||p.x>=viewport.width||p.y>=viewport.height))throw new Error('Deixe as casas de origem e destino visíveis no navegador');
    return await unobstructed(source.frame,async()=>{
    await source.page.mouse.click(from.x,from.y);
    const again=await snapshot(source.frame);
    if(again?.fen!==request.fen)throw new Error('A posição mudou durante a seleção');
    await source.page.mouse.click(to.x,to.y);
    const deadline=Date.now()+5000;
    while(Date.now()<deadline){
      const observed=await snapshot(source.frame);
      if(observed?.gameId!==request.gameId)throw new Error('A partida mudou');
      if(observed?.fen&&observed.fen!==request.fen)return {confirmed:true};
      await new Promise(r=>setTimeout(r,60));
    }
    throw new Error('O cliente não confirmou o lance; não será repetido automaticamente');
    });
  }finally{busy.delete(source.page);}
});
await registerBridge(context);
}
