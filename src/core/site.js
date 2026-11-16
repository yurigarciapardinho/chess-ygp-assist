// Launch pages and native game windows share these public paths. The native
// window does not retain the launcher's F2P object.
const chessPath=/\/(?:chess|xadrez)(?:blitz|bullet[12]?|freestyle|pawn7)?(?:\/|$)/i;
const standardGames=new Set(['Chess','ChessBlitz','ChessBullet1','ChessBullet2']);
export function isStandardChess(game,type){return standardGames.has(game)&&(type==='chess'||type===game.toLowerCase());}
export function canMountAssist(win) {
  const host=win.location.hostname;
  if(host!=='www.flyordie.com'&&!['127.0.0.1','localhost'].includes(host))return false;
  try{if(win.top!==win)return false;}catch{return false;}
  if(host!=='www.flyordie.com'||chessPath.test(win.location.pathname))return true;
  return String(win.F2P?.gn||win.P?.GAME||'').startsWith('Chess');
}
