import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRenderedMove, HistoryRows } from '../src/adapters/canvas-history.js';
import { isStartingLayout } from '../src/adapters/render-capture.js';
import { parseInfo, verifiedAsset, verifiedBytes } from '../src/engine/uci.js';

test('long algebraic rendering preserves capture, promotion, check and both castling sides',()=>{
 assert.equal(parseRenderedMove('Kd5-c5','w'),'d5c5');
 assert.equal(parseRenderedMove('Rc2xa2','b'),'c2a2');
 assert.equal(parseRenderedMove('c7-c8=N+','w'),'c7c8n');
 assert.equal(parseRenderedMove('O-O-O','b'),'e8c8');
 assert.equal(parseRenderedMove('0-0','w'),'e1g1');
 assert.equal(parseRenderedMove('player-name','w'),null);
});
test('shadow text duplicates do not duplicate moves',()=>{
 const h=new HistoryRows();
 for(const [text,x,y] of [['1.',842,54],['1.',843,55],['e2-e4',940,54],['e2-e4',941,55],['e7-e5',1119,54],['e7-e5',1120,55]])h.observe(text,x,y);
 assert.deepEqual(h.moves().moves,['e2e4','e7e5']);assert.equal(h.moves().complete,true);
});
test('joining in the middle of a game does not fabricate a full FEN',()=>{
 const h=new HistoryRows();h.observe('42.',842,54);h.observe('Kd5-c5',940,54);
 assert.equal(h.moves().complete,false);
});
test('initial-board proof requires both complete pawn ranks and mirrored back ranks',()=>{
 const cells=new Map(),back=['r','n','b','q','k','b','n','r'];
 for(const [row,color] of [[0,'b'],[1,'b'],[6,'w'],[7,'w']])for(let col=0;col<8;col++)cells.set(row*8+col,color+(row===1||row===6?'p':back[col]));
 assert.equal(isStartingLayout(cells),true);
 cells.set(52,cells.get(48));cells.delete(48);assert.equal(isStartingLayout(cells),false);
 cells.set(48,'wp');cells.set(0,'bq');assert.equal(isStartingLayout(cells),false);
});
test('history gaps and black-only rows remain incomplete',()=>{
 const h=new HistoryRows();h.observe('1.',842,54);h.observe('e7-e5',1119,54);
 assert.equal(h.moves().complete,false);
});
test('unchanged canvas repaints reuse the decoded history without replaying it',()=>{
 const h=new HistoryRows();h.observe('1.',842,54);h.observe('e2-e4',940,54);
 const first=h.moves();h.observe('1.',842,54);h.observe('e2-e4',940,54);
 assert.equal(h.moves(),first);
 h.observe('e7-e5',1119,54);assert.notEqual(h.moves(),first);
});
test('UCI parser keeps the promotion suffix and ignores secondary PVs',()=>{
 assert.equal(parseInfo('info depth 10 score cp 52 pv a7a8n h8h7').move,'a7a8n');
 assert.equal(parseInfo('info depth 10 multipv 2 score cp 5 pv e2e4'),null);
});
test('asset verification refuses an arbitrary executable source before a fetch',async()=>{
 let called=false;
 await assert.rejects(verifiedAsset({url:'https://example.com/engine.js'},()=>{called=true;}),/Origem/);
 assert.equal(called,false);
});
test('asset verification rejects byte mismatches and digest mismatches',async()=>{
 const url='https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/test.js';
 await assert.rejects(verifiedAsset({url,bytes:1,sha256:'0'.repeat(64)},async()=>new Response('xx')),/Tamanho/);
 await assert.rejects(verifiedAsset({url,bytes:1,sha256:'0'.repeat(64)},async()=>new Response('x')),/Integridade/);
});
test('an embedded engine byte cannot be changed without rejecting the asset',async()=>{
 const data=new TextEncoder().encode('verified');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');
 assert.equal(await verifiedBytes(data,{bytes:data.length,sha256:hash}),data);
 const corrupt=data.slice();corrupt[0]^=1;
 await assert.rejects(verifiedBytes(corrupt,{bytes:data.length,sha256:hash}),/Integridade/);
});
