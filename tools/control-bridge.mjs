import { randomUUID } from 'node:crypto';

export function installIsolatedBridge(channel){
  const requestPrefix='YGP_ASSIST_REQUEST_V2:',responsePrefix='YGP_ASSIST_RESPONSE_V2:';
  document.addEventListener(requestPrefix+channel,async event=>{
    if(typeof event.detail!=='string'||!event.detail.startsWith(requestPrefix)||event.detail.length>2048)return;
    let id;
    try{
      const value=JSON.parse(event.detail.slice(requestPrefix.length));id=value.id;
      if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))return;
      const input=value.request;
      if(!input||!['harvest','playMove'].includes(input.type))throw new Error('Operação inválida');
      let request={type:'harvest'};
      if(input.type==='playMove'){
        if(typeof input.fen!=='string'||input.fen.length>256||typeof input.gameId!=='string'||input.gameId.length>80||typeof input.move!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(input.move))throw new Error('Lance inválido');
        request={type:'playMove',fen:input.fen,gameId:input.gameId,move:input.move};
      }
      const result=await window.__YGPRequest(request);
      document.dispatchEvent(new CustomEvent(responsePrefix+channel,{detail:responsePrefix+JSON.stringify({id,ok:true,result})}));
    }catch(error){
      if(id)document.dispatchEvent(new CustomEvent(responsePrefix+channel,{detail:responsePrefix+JSON.stringify({id,ok:false,error:String(error.message||error).slice(0,300)})}));
    }
  });
}

export function installPageBridge(channel){
  if(typeof window.__YGPRequest==='function')return;
  const requestPrefix='YGP_ASSIST_REQUEST_V2:',responsePrefix='YGP_ASSIST_RESPONSE_V2:',pending=new Map();
  document.addEventListener(responsePrefix+channel,event=>{
    if(typeof event.detail!=='string'||!event.detail.startsWith(responsePrefix)||event.detail.length>8192)return;
    try{
      const value=JSON.parse(event.detail.slice(responsePrefix.length)),entry=pending.get(value.id);
      if(!entry)return;pending.delete(value.id);clearTimeout(entry.timer);
      value.ok?entry.resolve(value.result):entry.reject(new Error(String(value.error||'Falha no controlador')));
    }catch{}
  });
  Object.defineProperty(window,'__YGPRequest',{configurable:true,value:request=>{
    if(pending.size>=4)return Promise.reject(new Error('Aguarde as operações pendentes'));
    if(!request||!['harvest','playMove'].includes(request.type))return Promise.reject(new Error('Operação inválida'));
    const clean=request.type==='harvest'?{type:'harvest'}:{type:'playMove',fen:request.fen,gameId:request.gameId,move:request.move};
    const id=crypto.randomUUID(),message=requestPrefix+JSON.stringify({id,request:clean});
    if(message.length>2048)return Promise.reject(new Error('Pedido muito grande'));
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error('O controlador não respondeu'));},request.type==='harvest'?300000:15000);
      pending.set(id,{resolve,reject,timer});
      document.dispatchEvent(new CustomEvent(requestPrefix+channel,{detail:message}));
    });
  }});
}

export async function registerBridge(context){
  const channel=randomUUID();
  await context.addInitScript(installIsolatedBridge,channel);
  await context.addInitScript('mw:('+installPageBridge.toString()+')('+JSON.stringify(channel)+')');
}
