import { HistoryRows, parseRenderedMove } from './rendered-history.js';

// Capture native drawing commands before the first paint, without pixel
// readback. Sprite rows and square locations supply the initial-board proof.
const KEY='__YGP_RENDER_CAPTURE__';
const number=text=>/^([1-9]\d{0,3})\.$/.exec(text);
export function isStartingLayout(cells) {
  if(cells.size!==32)return false;
  const ranks=[0,1,6,7].map(row=>Array.from({length:8},(_,col)=>cells.get(row*8+col)));
  if(ranks.some(rank=>rank.some(piece=>!piece)))return false;
  const [top,pawns,otherPawns,bottom]=ranks;
  const back=rank=>new Set(rank).size===5&&rank[0]===rank[7]&&rank[1]===rank[6]&&rank[2]===rank[5];
  return back(top)&&back(bottom)&&new Set(pawns).size===1&&new Set(otherPawns).size===1&&new Set(ranks.flat()).size===12;
}
function rect(ctx,x,y,width,height){
  const m=ctx.getTransform();
  if(Math.abs(m.b)+Math.abs(m.c)>.001||m.a<=0||m.d<=0)return null;
  return {x:m.a*x+m.e,y:m.d*y+m.f,width:m.a*width,height:m.d*height};
}
function imageRect(ctx,image,args){
  if(args.length===8)return rect(ctx,...args.slice(4));
  if(args.length===4)return rect(ctx,...args);
  if(args.length===2)return rect(ctx,...args,image.width,image.height);
  return null;
}
export function getRenderCapture(win) {
  if(win[KEY]?.version===4)return win[KEY];
  const proto=win.CanvasRenderingContext2D?.prototype;
  if(!proto)return null;
  const capture={
    version:4,history:new HistoryRows(),gameId:win.crypto.randomUUID(),canvas:null,source:null,
    fullRect:null,logicalSize:688,orientation:'w',orientationVerified:false,myColor:null,visibleRows:new Set(),
    historyArea:null,available:false,initial:false,shortHistory:false,revision:0,
  };
  const boards=new WeakMap(),images=new WeakMap();
  const clips=new WeakMap();
  function clipState(ctx){
    let state=clips.get(ctx);
    if(!state||state.width!==ctx.canvas.width||state.height!==ctx.canvas.height){
      state={width:ctx.canvas.width,height:ctx.canvas.height,bounds:null,path:null,stack:[]};clips.set(ctx,state);
    }
    return state;
  }
  function intersect(a,b){
    if(!a||!b)return a||b;
    if(a.unknown||b.unknown)return {unknown:true};
    const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y);
    return {x,y,width:Math.max(0,Math.min(a.x+a.width,b.x+b.width)-x),height:Math.max(0,Math.min(a.y+a.height,b.y+b.height)-y)};
  }
  function clipped(ctx,r){
    const bounds=clipState(ctx).bounds;
    const result=intersect(r,bounds);
    return result&&!result.unknown?result:null;
  }
  function fullyVisible(ctx,r){
    const c=clipped(ctx,r);
    return c&&Math.abs(c.x-r.x)<1&&Math.abs(c.y-r.y)<1&&Math.abs(c.width-r.width)<1&&Math.abs(c.height-r.height)<1;
  }
  let nextImage=0,pending=null,scheduled=false,visibleAt=0,resetRows=false;
  const boardState=canvas=>{
    if(canvas.width!==canvas.height||canvas.width<300||canvas.width>1600||canvas.id==='game')return null;
    let state=boards.get(canvas);
    if(!state){state={cells:new Map(),letters:new Map()};boards.set(canvas,state);}
    return state;
  };
  function reset(){
    capture.history=new HistoryRows();capture.gameId=win.crypto.randomUUID();
    capture.myColor=null;capture.orientationVerified=false;capture.visibleRows.clear();
    capture.initial=false;capture.shortHistory=false;
  }
  function batch(canvas){
    if(canvas.id!=='game'||canvas.ownerDocument!==win.document)return null;
    if(!pending)pending={canvas,texts:[],clears:[],pieces:[],board:null};
    if(!scheduled){scheduled=true;win.queueMicrotask(flush);}
    return pending;
  }
  function flush(){
    scheduled=false;
    const paint=pending;pending=null;if(!paint)return;
    const {canvas,texts,clears,board,pieces}=paint;
    capture.canvas=canvas;
    const full=clears.some(r=>r.x<=1&&r.y<=1&&r.width>=canvas.width-2&&r.height>=canvas.height-2);
    if(board){
      if(capture.source&&capture.source!==board.image)reset();
      capture.source=board.image;capture.fullRect=board.rect;capture.logicalSize=board.logicalSize;capture.available=true;
      const state=boards.get(board.image);
      const cells=new Map(state?.cells||[]);
      const tile=board.rect.width*(board.logicalSize-48)/8/board.logicalSize,padding=board.rect.width*24/board.logicalSize;
      for(const piece of pieces){
        const col=Math.round((piece.rect.x-board.rect.x-padding)/tile),row=Math.round((piece.rect.y-board.rect.y-padding)/tile);
        if(col>=0&&col<8&&row>=0&&row<8&&Math.abs(piece.rect.width-tile)<1&&Math.abs(piece.rect.height-tile)<1&&Math.abs(piece.rect.x-board.rect.x-padding-col*tile)<1&&Math.abs(piece.rect.y-board.rect.y-padding-row*tile)<1)cells.set(row*8+col,piece.key);
      }
      if(board.fullPaint)capture.initial=isStartingLayout(cells);
      const a=state?.letters.get('a'),h=state?.letters.get('h');
      if(Number.isFinite(a)&&Number.isFinite(h)){
        capture.orientation=a<h?'w':'b';capture.orientationVerified=true;
      }
    }else if(full){
      // The lobby reuses #game; a former board must not remain synchronized.
      if(capture.available)reset();
      capture.source=null;capture.fullRect=null;capture.historyArea=null;
      capture.available=false;capture.history.tail=false;capture.initial=false;
    }
    const r=capture.fullRect;
    if(!r||!capture.available)return;
    const right=r.x+r.width;
    const rows=texts.filter(t=>t.x>right&&t.y>0&&t.y<canvas.height*.34&&!t.own);
    const numbers=rows.filter(t=>number(t.text));
    const pane=clears.find(c=>c.x>=right-2&&c.x<canvas.width-100&&c.y<100&&c.width>=130&&c.height>=90);
    const fresh=full||!!pane;
    const lastY=Math.max(0,...numbers.map(t=>t.y));
    const ys=[];
    for(const y of numbers.map(t=>t.y).sort((a,b)=>a-b))if(!ys.length||y-ys.at(-1)>2)ys.push(y);
    const spacing=ys.length>1?Math.min(...ys.slice(1).map((y,i)=>y-ys[i])):24;
    const bottom=pane?Math.min(pane.y+pane.height,canvas.height*.34):canvas.height*.34;
    const allVisible=fresh&&numbers.length>0&&Math.min(...numbers.map(t=>+number(t.text)[1]))===1&&ys.length<7&&bottom-lastY>=spacing*1.5;
    const noMoves=!rows.some(t=>parseRenderedMove(t.text,'w'));
    const blankFirstRow=noMoves&&numbers.every(t=>+number(t.text)[1]===1);
    const emptyInitial=fresh&&board?.fullPaint&&capture.initial&&blankFirstRow;
    if(fresh&&board?.fullPaint&&(rows.length===0||emptyInitial)&&(capture.history.rows.size||capture.history.conflict))reset();
    if(allVisible&&capture.history.rows.size>Math.max(...numbers.map(t=>+number(t.text)[1])))reset();
    if(board){
      const letters=boards.get(board.image)?.letters;
      if(letters?.has('a')&&letters.has('h')){
        capture.orientation=letters.get('a')<letters.get('h')?'w':'b';capture.orientationVerified=true;
      }
    }
    if(numbers.length&&(fresh||resetRows||Date.now()-visibleAt>150))capture.visibleRows.clear();
    if(numbers.length)resetRows=false;
    for(const t of rows){
      const n=number(t.text);
      if(n){
        capture.visibleRows.add(+n[1]);visibleAt=Date.now();
        capture.historyArea={x:t.x+150,y:Math.max(30,t.y)};
      }
      capture.history.observe(t.text,t.x,t.y);
    }
    for(const t of texts)if(t.own&&t.y<r.y&&t.x>r.x&&t.x<right)capture.myColor=t.x<r.x+r.width/2?'w':'b';
    if(!capture.historyArea)capture.historyArea={x:right+(canvas.width-right)*.5,y:Math.min(100,canvas.height*.2)};
    if(fresh||board?.fullPaint||rows.length)capture.shortHistory=emptyInitial||(allVisible&&capture.history.moves().complete);
    if(capture.shortHistory)capture.history.tail=true;
    if(fresh||board?.fullPaint||rows.length)capture.initial=emptyInitial;
    capture.revision++;
  }
  function erase(state,r){
    if(!state||!r)return;
    for(const square of state.cells.keys()){
      const x=24+(square%8)*80,y=24+Math.floor(square/8)*80;
      if(r.x<=x+1&&r.y<=y+1&&r.x+r.width>=x+79&&r.y+r.height>=y+79)state.cells.delete(square);
    }
  }
  const observe={
    save(ctx){if(ctx.canvas.id==='game'){const s=clipState(ctx);s.stack.push(s.bounds);}},
    restore(ctx){if(ctx.canvas.id==='game'){const s=clipState(ctx);if(s.stack.length)s.bounds=s.stack.pop();}},
    beginPath(ctx){if(ctx.canvas.id==='game')clipState(ctx).path=null;},
    rect(ctx,args){if(ctx.canvas.id==='game')clipState(ctx).path=rect(ctx,...args);},
    clip(ctx,args){
      if(ctx.canvas.id!=='game')return;
      const s=clipState(ctx);
      s.bounds=intersect(s.bounds,(!args.length||typeof args[0]==='string')&&s.path?s.path:{unknown:true});
    },
    fillText(ctx,args){
      const [raw,x,y]=args,text=String(raw),state=boardState(ctx.canvas),r=rect(ctx,x,y,0,0);
      if(!r)return;
      if(ctx.canvas.id==='game'){
        const bounds=clipState(ctx).bounds;
        if(bounds&&(bounds.unknown||r.x<bounds.x||r.x>bounds.x+bounds.width||r.y<bounds.y||r.y>bounds.y+bounds.height+2))return;
      }
      if(state&&/^[a-h]$/i.test(text))state.letters.set(text.toLowerCase(),r.x);
      const own=!!win.P?.PLAYER&&text===win.P.PLAYER;
      if(!own&&!number(text)&&!parseRenderedMove(text,'w'))return;
      batch(ctx.canvas)?.texts.push({text:own?'':text,x:r.x,y:r.y,own});
    },
    fillRect(ctx,args){
      const r=clipped(ctx,rect(ctx,...args));erase(boardState(ctx.canvas),r);
      const paint=batch(ctx.canvas);if(paint&&r)paint.clears.push(r);
    },
    clearRect(ctx,args){this.fillRect(ctx,args);},
    drawImage(ctx,args){
      const [image,...coords]=args,r=imageRect(ctx,image,coords);if(!r)return;
      const sprite=image.tagName==='IMG'&&image.width===480&&image.height===1152&&coords.length===8&&coords[2]===96&&coords[3]===96;
      if(sprite&&!images.has(image))images.set(image,++nextImage);
      const state=boardState(ctx.canvas);
      if(state){
        erase(state,r);
        if(sprite&&Math.abs(r.width-80)<1&&Math.abs(r.height-80)<1){
          const col=Math.round((r.x-24)/80),row=Math.round((r.y-24)/80);
          if(col>=0&&col<8&&row>=0&&row<8&&Math.abs(r.x-24-col*80)<1&&Math.abs(r.y-24-row*80)<1){
            state.cells.set(row*8+col,images.get(image)+':'+Math.round(coords[1]/96));
          }
        }else if(boards.has(image)&&r.x===0&&r.y===0&&r.width===688&&r.height===688){
          state.cells=new Map(boards.get(image).cells);state.letters=new Map(boards.get(image).letters);
        }
      }
      const paint=batch(ctx.canvas);
      if(paint&&sprite&&fullyVisible(ctx,r))paint.pieces.push({rect:r,key:images.get(image)+':'+Math.round(coords[1]/96)});
      const crop=coords.length===8?coords.slice(0,4):[0,0,image.width,image.height];
      const tile=(crop[2]-48)/8;
      if(paint&&image.tagName==='CANVAS'&&image.width===image.height&&crop[0]===0&&crop[1]===0&&crop[2]===crop[3]&&crop[2]>=300&&image.width>=crop[2]&&image.width-crop[2]<=64&&Number.isInteger(tile)&&tile>=32&&tile<=160&&Math.abs(r.width-r.height)<2)paint.board={image,rect:r,logicalSize:crop[2],fullPaint:fullyVisible(ctx,r)};
      else if(paint&&image.tagName!=='IMG'){const c=clipped(ctx,r);if(c)paint.clears.push(c);}
    },
  };
  for(const name of Object.keys(observe)){
    const original=proto[name];
    proto[name]=function(...args){
      const result=Reflect.apply(original,this,args);
      try{observe[name](this,args);}catch{}
      return result;
    };
  }
  win.addEventListener('wheel',event=>{
    const canvas=capture.canvas,r=canvas?.getBoundingClientRect(),b=capture.fullRect;
    if(!r?.width||!b)return;
    const x=(event.clientX-r.x)*canvas.width/r.width,y=(event.clientY-r.y)*canvas.height/r.height;
    if(x>b.x+b.width&&y>=0&&y<canvas.height*.34){
      resetRows=true;capture.shortHistory=false;
      if(event.isTrusted&&event.deltaY<0)capture.history.tail=false;
    }
  },{passive:true,capture:true});
  capture.flush=flush;
  Object.defineProperty(win,KEY,{value:capture,configurable:true});
  return capture;
}
