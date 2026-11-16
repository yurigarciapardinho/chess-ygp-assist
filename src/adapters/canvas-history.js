import { getRenderCapture } from './render-capture.js';
import { DEFAULT_POSITION } from 'chess.js';
export { HistoryRows, parseRenderedMove } from './rendered-history.js';

export class CanvasHistoryReader {
  constructor(win,canvas){
    this.win=win;this.canvas=canvas;this.capture=getRenderCapture(win);
    // The launcher records the first paint; late installation needs a repaint.
    if(!this.capture?.source)win.dispatchEvent(new win.Event('resize'));
  }
  get history(){this.capture.flush();return this.capture.history;}
  boardRect(){
    const capture=this.capture;capture.flush();
    if(!capture.available||!capture.fullRect||this.win.P?.CODE_RELEASE!=='20260722')return null;
    const r=capture.fullRect,size=r.width*(capture.logicalSize-48)/capture.logicalSize,padding=(r.width-size)/2;
    const c=this.canvas.getBoundingClientRect(),sx=c.width/this.canvas.width,sy=c.height/this.canvas.height;
    return {x:c.x+(r.x+padding)*sx,y:c.y+(r.y+padding)*sy,width:size*sx,height:size*sy};
  }
  historyPoint(){
    const point=this.capture.historyArea;if(!point)return null;
    const c=this.canvas.getBoundingClientRect();
    return {x:c.x+point.x*c.width/this.canvas.width,y:c.y+point.y*c.height/this.canvas.height};
  }
  diagnostics(){
    this.capture.flush();
    const c=this.capture,initial=c.available&&c.initial&&c.history.rows.size===0;
    return {...c.history.diagnostics(),...(initial?{complete:true,plies:0}:{}),initial,shortHistory:c.shortHistory,available:c.available,visible:[...c.visibleRows].sort((a,b)=>a-b),point:this.historyPoint(),board:this.boardRect(),orientationVerified:c.orientationVerified};
  }
  snapshot(){
    const c=this.capture;c.flush();
    const decoded=c.history.moves(),initial=c.available&&c.initial&&c.history.rows.size===0;
    const complete=c.available&&(initial||(decoded.complete&&c.history.tail));
    return {gameId:c.gameId,variant:'standard',fen:complete?(initial?DEFAULT_POSITION:decoded.chess.fen()):null,moves:decoded.moves,orientation:c.orientation,orientationVerified:c.orientationVerified,myColor:c.myColor,active:complete&&!!c.myColor&&(initial||!decoded.chess.isGameOver()),complete,source:'canvas-history',reason:complete?(initial?'Posição inicial confirmada':'Sincronizado pelo histórico de lances'):c.available?'Recupere o histórico completo com Sincronizar':'Aguardando um tabuleiro do FlyOrDie'};
  }
  dispose(){}
}
