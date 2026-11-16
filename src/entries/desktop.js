import { importPosition, legalMove } from '../core/position.js';
import { Session } from '../core/session.js';
import { FlyOrDieAdapter } from '../adapters/flyordie.js';
import { UciEngine } from '../engine/uci.js';
import { mountPanel } from '../ui/panel.js';
import { engineAssets } from 'ygp:engine-assets';
import { getRenderCapture } from '../adapters/render-capture.js';
import { canMountAssist } from '../core/site.js';

export function startAssist(win=window) {
  if(!canMountAssist(win))return;
  if(win.YGPAssist?.version==='0.1.0-alpha.1'&&win.document.querySelector('ygp-assist-root')?.isConnected)return win.YGPAssist;
  win.YGPAssist?.dispose();
  const adapter=new FlyOrDieAdapter(win),session=new Session();
  let engine=null,manual=false,result=null,disposed=false,settings={depth:14,auto:true,arrows:true,voice:false},analysisTimer=null,syncing=false;
  let ui;
  const engineFactory=()=>new UciEngine({assets:engineAssets,onProgress:text=>ui.engine(text)});
  const error=error=>{if(error.name!=='AbortError')ui.status(error.message||String(error),true);};
  function update(snapshot) {
    if(manual||disposed)return;
    ui.source(snapshot.complete?'FlyOrDie · histórico completo'+(snapshot.orientationVerified?'':' · escolha a visão para as setas'):'FlyOrDie · aguardando sincronização');
    if(session.update(snapshot)){result=null;ui.position(snapshot);if(settings.auto&&snapshot.fen)schedule();}
    if(!snapshot.fen&&!syncing)ui.status(snapshot.reason);
    ui.geometry(snapshot.orientationVerified?adapter.geometry():null,snapshot.orientation);
  }
  function schedule(){clearTimeout(analysisTimer);analysisTimer=setTimeout(()=>analyse().catch(error),100);}
  async function analyse() {
    if(!manual)update(adapter.readSnapshot());
    clearTimeout(analysisTimer);
    const snapshot=session.snapshot;
    if(!snapshot?.fen)throw new Error('Sincronize o histórico ou importe uma FEN completa');
    const request=session.request();ui.busy(true);ui.status('Analisando…');
    try{
      if(!engine||engine.closed)engine=engineFactory();
      const analysed=await engine.analyse(snapshot.fen,{depth:settings.depth,signal:request.signal});
      if(!session.current(request))return null;
      result=analysed;
      const canPlay=!!win.__YGPRequest&&!manual&&snapshot.active&&snapshot.myColor===snapshot.fen.split(' ')[1]&&snapshot.orientationVerified&&!!adapter.geometry();
      ui.result(analysed,canPlay);ui.status(manual?'Análise da posição importada':'Posição sincronizada');
      if(settings.voice&&analysed&&win.speechSynthesis){
        const utterance=new win.SpeechSynthesisUtterance(analysed.san);utterance.lang='pt-BR';win.speechSynthesis.cancel();win.speechSynthesis.speak(utterance);
      }
      return analysed;
    }finally{if(session.current(request)){ui.busy(false);if(result)ui.result(result,!!win.__YGPRequest&&!manual&&snapshot.active&&snapshot.myColor===snapshot.fen.split(' ')[1]&&snapshot.orientationVerified&&!!adapter.geometry());}}
  }
  async function sync() {
    manual=false;result=null;session.cancel();ui.geometry(null);
    if(!win.__YGPRequest){ui.status('O launcher Camoufox recupera o histórico automaticamente. Use npm run browser ou importe FEN/PGN.',true);return;}
    syncing=true;ui.status('Recuperando o histórico completo…');
    try{await win.__YGPRequest({type:'harvest'});update(adapter.readSnapshot());}
    finally{syncing=false;}
  }
  async function play() {
    const snapshot=session.snapshot;
    if(manual||!result||!snapshot?.active||!win.__YGPRequest)throw new Error('A entrada de lances não está disponível nesta posição');
    if(!legalMove(snapshot.fen,result.move))throw new Error('Lance desatualizado');
    ui.busy(true);
    try{await win.__YGPRequest({type:'playMove',fen:snapshot.fen,gameId:snapshot.gameId,move:result.move});}
    finally{update(adapter.readSnapshot());ui.busy(false);}
  }
  function dispose(){
    if(disposed)return;disposed=true;win.removeEventListener('pagehide',dispose);clearTimeout(analysisTimer);session.cancel();adapter.dispose();engine?.dispose();ui.dispose();win.speechSynthesis?.cancel();if(win.YGPAssist===api)delete win.YGPAssist;
  }
  ui=mountPanel({onAnalyse:analyse,onSync:sync,onPlay:play,onImport:text=>{
    const position=importPosition(text);manual=true;result=null;session.update({gameId:'manual-'+win.crypto.randomUUID(),variant:'standard',fen:position.fen(),orientation:'w',active:false,complete:true,source:'manual'});
    ui.position(session.snapshot);ui.geometry(null);ui.source('Análise independente · FEN/PGN importado');ui.status('Posição importada');if(settings.auto)schedule();
  },onSettings:value=>{
    settings=value;adapter.orientationMode=value.orientation;session.cancel();
    try{win.localStorage.setItem('ygp-assist-settings-v2',JSON.stringify(value));}catch{}
    if(!manual)update(adapter.readSnapshot());
    else if(session.snapshot){session.update({...session.snapshot,orientation:value.orientation==='b'?'b':'w'});ui.position(session.snapshot);}
    if(settings.auto&&session.snapshot?.fen)schedule();
  },onDispose:dispose});
  try{const raw=win.localStorage.getItem('ygp-assist-settings-v2');if(raw&&raw.length<1024)ui.restoreSettings(JSON.parse(raw));}catch{}
  settings=ui.settings();adapter.orientationMode=settings.orientation;
  const api=Object.freeze({
    version:'0.1.0-alpha.1',
    getSnapshot:()=>{const current=manual?session.snapshot:adapter.readSnapshot();return current?JSON.parse(JSON.stringify(current)):null;},
    setPanelHidden:value=>ui.setPanelHidden(value),
    getGeometry:()=>adapter.geometry(),
    diagnostics:()=>adapter.diagnostics(),
    beginHarvest:()=>adapter.beginHarvest(),
    confirmTail:()=>adapter.confirmTail(),
    analyse,dispose,
  });
  win.YGPAssist=api;
  adapter.subscribe(update);
  win.addEventListener('pagehide',dispose,{once:true});
  return api;
}

if(typeof window!=='undefined'){
  if(window.location.hostname==='www.flyordie.com'&&window.location.pathname==='/games/webapp/x.html')getRenderCapture(window);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>startAssist(),{once:true});
  else startAssist();
}
