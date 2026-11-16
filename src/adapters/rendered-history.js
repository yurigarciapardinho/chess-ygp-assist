import { replayMoves } from '../core/position.js';

// Passive observation of the UI's existing canvas calls. No packets, client
// rules or authentication code are intercepted or modified.
export function parseRenderedMove(text, color) {
  text=String(text).trim();
  if (/^[O0]-[O0](?:-[O0])?[+#]?$/.test(text)) return (color==='w'?'e1':'e8')+(/^[O0]-[O0]-[O0]/.test(text)?(color==='w'?'c1':'c8'):(color==='w'?'g1':'g8'));
  const m=text.match(/^[KQRBN]?([a-h][1-8])[-x]([a-h][1-8])(?:=?([QRBN]))?[+#]?$/);
  return m?m[1]+m[2]+(m[3]?.toLowerCase()||''):null;
}

export class HistoryRows {
  rows=new Map();
  anchor=null;
  conflict=false;
  tail=false;
  version=0;
  cached=null;
  observe(text,x,y) {
    const number=String(text).match(/^([1-9]\d{0,3})\.$/);
    if(number){this.anchor={number:Number(number[1]),x,y};return;}
    if(!this.anchor||Math.abs(y-this.anchor.y)>2||x<=this.anchor.x+15)return;
    if(!parseRenderedMove(text,'w'))return;
    let row=this.rows.get(this.anchor.number);
    if(!row){row=[];this.rows.set(this.anchor.number,row);this.version++;}
    const offset=x-this.anchor.x;
    const old=row.find(cell=>Math.abs(cell.offset-offset)<10);
    if(old){if(old.text!==text){old.text=text;this.tail=false;this.version++;}return;}
    row.push({text,offset});row.sort((a,b)=>a.offset-b.offset);this.version++;
    if(row.length>2){this.conflict=true;this.tail=false;}
  }
  moves() {
    if(this.cached?.version===this.version)return this.cached.value;
    const value=this.decode();this.cached={version:this.version,value};return value;
  }
  decode() {
    const moves=[];
    const numbers=[...this.rows.keys()].sort((a,b)=>a-b);
    if(numbers[0]!==1||this.conflict)return {complete:false,moves};
    for(let i=0;i<numbers.length;i++){
      if(numbers[i]!==i+1)return {complete:false,moves};
      const row=this.rows.get(i+1);
      if(!row.length||row.length>2)return {complete:false,moves};
      // The observed client draws the white column about 90 px and the
      // black column about 275 px after the row number (at its virtual scale).
      // Reject a black-only row instead of guessing the side.
      if(row[0].offset>180)return {complete:false,moves};
      moves.push(parseRenderedMove(row[0].text,'w'));
      if(row[1])moves.push(parseRenderedMove(row[1].text,'b'));
      else if(i<numbers.length-1)return {complete:false,moves};
    }
    try{return {complete:true,moves,chess:replayMoves(moves)};}catch{return {complete:false,moves};}
  }
  diagnostics() {
    const keys=[...this.rows.keys()];
    const decoded=this.moves();
    return {first:keys.length?Math.min(...keys):null,last:keys.length?Math.max(...keys):null,rows:keys.length,plies:decoded.moves.length,complete:decoded.complete,tail:this.tail};
  }
}
