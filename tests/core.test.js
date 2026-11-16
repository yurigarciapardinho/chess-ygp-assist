import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { checkedFen, replayMoves, legalMove, importPosition } from '../src/core/position.js';
import { squareCenter, clampPanel, frameOffset } from '../src/core/geometry.js';
import { Session } from '../src/core/session.js';

test('FEN must contain all six fields; command injection and partial positions are rejected',()=>{
 assert.throws(()=>checkedFen('8/8/8/8/8/8/8/8'));
 assert.throws(()=>checkedFen(new Chess().fen()+'\ngo depth 24'));
 assert.equal(checkedFen(new Chess().fen()),new Chess().fen());
});
test('history preserves lost castling rights after king and rook return',()=>{
 const initial='r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
 const chess=replayMoves(['h1h2','h8h7','h2h1','h7h8'],initial);
 assert.equal(chess.fen().split(' ')[2],'Qq');
});
test('history preserves en passant and rejects a missing promotion choice',()=>{
 const game=replayMoves(['e2e4','a7a6','e4e5','d7d5']);
 assert.equal(game.fen().split(' ')[3],'d6');
 assert.ok(legalMove(game.fen(),'e5d6').flags.includes('e'));
 const fen='7k/P7/8/8/8/8/8/7K w - - 0 1';
 for(const choice of ['q','r','b','n'])assert.equal(legalMove(fen,'a7a8'+choice).promotion,choice);
 assert.equal(legalMove(fen,'a7a8'),null);
});
test('PGN import and replay produce identical complete states',()=>{
 const game=importPosition('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6');
 assert.equal(game.fen(),replayMoves(['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6']).fen());
});
test('64 square coordinates remain unique in both orientations and use CSS pixels',()=>{
 const rect={x:257.5,y:34.25,width:413.5,height:413.5};
 for(const side of ['w','b']){
  const points=new Set();
  for(const file of 'abcdefgh')for(let rank=1;rank<=8;rank++){
   const p=squareCenter(file+rank,rect,side);
   assert.ok(p.x>rect.x&&p.x<rect.x+rect.width&&p.y>rect.y&&p.y<rect.y+rect.height);
   points.add(JSON.stringify(p));
  }
  assert.equal(points.size,64);
 }
 assert.deepEqual(squareCenter('a1',rect,'w'),squareCenter('h8',rect,'b'));
});
test('panel clamping includes actual height and width',()=>{
 assert.deepEqual(clampPanel(900,800,320,600,1000,800),{x:672,y:192});
});
test('nested frame geometry accounts for scaled iframes and borders',()=>{
 const outer={};
 const middle={parent:outer,frameElement:{offsetWidth:100,offsetHeight:100,clientLeft:2,clientTop:2,getBoundingClientRect:()=>({x:10,y:20,width:200,height:200})}};
 const inner={parent:middle,frameElement:{offsetWidth:100,offsetHeight:100,clientLeft:1,clientTop:1,getBoundingClientRect:()=>({x:30,y:40,width:100,height:100})}};
 assert.deepEqual(frameOffset(inner,outer),{x:76,y:106,scaleX:2,scaleY:2});
});
test('position changes invalidate pending analysis even if a later position matches again',()=>{
 const session=new Session(),initial=new Chess().fen();
 session.update({gameId:'one',variant:'standard',fen:initial,orientation:'w'});
 const request=session.request();
 session.update({gameId:'one',variant:'standard',fen:replayMoves(['e2e4']).fen(),orientation:'w'});
 session.update({gameId:'one',variant:'standard',fen:initial,orientation:'w'});
 assert.equal(session.current(request),false);
});
test('identical polling snapshots keep the same revision',()=>{
 const session=new Session(),snapshot={gameId:'one',variant:'standard',fen:new Chess().fen(),orientation:'w'};
 assert.equal(session.update(snapshot),true);
 const request=session.request(),revision=session.revision;
 assert.equal(session.update({...snapshot}),false);
 assert.equal(session.revision,revision);
 assert.equal(session.current(request),true);
});
