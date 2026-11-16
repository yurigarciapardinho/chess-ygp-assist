import { CanvasHistoryReader } from './canvas-history.js';
import { frameOffset } from '../core/geometry.js';
import { isStandardChess } from '../core/site.js';

export class FlyOrDieAdapter {
  constructor(win=window){this.win=win;this.reader=null;this.frame=null;this.timer=null;this.disposed=false;}
  discover(){
    const visit=(win,depth)=>{
      if(depth>5)return null;
      try{
        if(win.location.hostname!=='www.flyordie.com')return null;
        const canvas=win.document.querySelector('canvas#game');
        if(canvas&&win.location.pathname==='/games/webapp/x.html')return {win,canvas};
        for(let i=0;i<win.frames.length;i++){const found=visit(win.frames[i],depth+1);if(found)return found;}
      }catch{}
      return null;
    };
    const found=visit(this.win,0);
    if(found&&this.reader?.canvas!==found.canvas){this.reader?.dispose();found.win.__ygpPaintProbe?.restore();this.reader=new CanvasHistoryReader(found.win,found.canvas);this.frame=found.win;}
    if(!found&&this.reader){this.reader.dispose();this.reader=null;this.frame=null;}
    return found;
  }
  readSnapshot(){
    this.discover();
    if(!this.reader)return {gameId:'loading',variant:'standard',fen:null,active:false,complete:false,source:'loading',reason:'Abra uma partida ou a observação de uma partida'};
    const type=this.frame.P?.TYPE;
    const game=this.frame.P?.GAME;
    if(!isStandardChess(game,type))return {gameId:'unsupported',variant:String(game||type),fen:null,active:false,complete:false,reason:'Esta variante ainda não foi certificada'};
    const snapshot=this.reader.snapshot();
    if(['w','b'].includes(this.orientationMode)){snapshot.orientation=this.orientationMode;snapshot.orientationVerified=true;}
    return snapshot;
  }
  geometry(){
    const rect=this.reader?.boardRect();if(!rect)return null;
    try{const o=frameOffset(this.frame,this.win);return {x:rect.x*o.scaleX+o.x,y:rect.y*o.scaleY+o.y,width:rect.width*o.scaleX,height:rect.height*o.scaleY};}catch{return null;}
  }
  subscribe(listener){
    let pending=false;
    const poll=()=>{if(pending||this.disposed)return;pending=true;try{listener(this.readSnapshot());}finally{pending=false;}};
    poll();this.timer=this.win.setInterval(poll,400);
    return ()=>{this.win.clearInterval(this.timer);this.timer=null;};
  }
  diagnostics(){
    const diagnostic=this.reader?.diagnostics();if(!diagnostic)return null;
    try{const o=frameOffset(this.frame,this.win);if(diagnostic.point)diagnostic.point={x:diagnostic.point.x*o.scaleX+o.x,y:diagnostic.point.y*o.scaleY+o.y};}catch{return null;}
    return diagnostic;
  }
  confirmTail(){if(!this.reader)return false;const valid=this.reader.diagnostics().initial||this.reader.history.moves().complete;this.reader.history.tail=valid;return valid;}
  beginHarvest(){if(this.reader)this.reader.history.tail=false;}
  dispose(){this.disposed=true;this.win.clearInterval(this.timer);this.reader?.dispose();this.reader=null;this.frame=null;}
}
