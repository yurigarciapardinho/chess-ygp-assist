import test from 'node:test';
import assert from 'node:assert/strict';
import { canMountAssist, isStandardChess } from '../src/core/site.js';

function windowAt(path,host='www.flyordie.com'){
 const win={location:{hostname:host,pathname:path}};
 win.top=win;return win;
}
test('native chess windows mount without the landing-page F2P object',()=>{
 for(const path of ['/chess','/pt_BR/xadrez','/pt_BR/xadrezbullet2','/pt_BR/xadrezbullet1','/pt_BR/xadrezblitz','/chessbullet2','/chessblitz','/pt_BR/xadrezbullet2/play']){
  assert.equal(canMountAssist(windowAt(path)),true,path);
 }
});
test('the panel stays out of same-origin game and play frames',()=>{
 for(const path of ['/games/webapp/x.html','/pt_BR/xadrezbullet2/play']){
  const win=windowAt(path);win.top=windowAt('/pt_BR/xadrezbullet2');win.P={GAME:'Chess'};
  assert.equal(canMountAssist(win),false);
 }
 const ranking=windowAt('/ranking/ChessBullet2');ranking.P={GAME:'ChessBullet2'};
 ranking.top={get location(){throw new Error('Sandboxed frame');}};
 assert.equal(canMountAssist(ranking),false);
});
test('unrelated game paths and hosts do not receive a chess panel',()=>{
 assert.equal(canMountAssist(windowAt('/billiard')),false);
 assert.equal(canMountAssist(windowAt('/pt_BR/xadrezbullet2','example.com')),false);
 assert.equal(canMountAssist(windowAt('/chessbullet25')),false);
});
test('speed-specific standard chess identifiers pass without accepting other rule variants',()=>{
 for(const game of ['Chess','ChessBlitz','ChessBullet1','ChessBullet2']){
  assert.equal(isStandardChess(game,'chess'),true);
  assert.equal(isStandardChess(game,game.toLowerCase()),true);
 }
 for(const game of ['Chess960','ChessFreestyle','ChessPawn7','Pawn7'])assert.equal(isStandardChess(game,'chess'),false);
 assert.equal(isStandardChess('ChessBullet2','checkers'),false);
});
