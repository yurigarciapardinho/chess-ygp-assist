import { Chess, validateFen } from 'chess.js';

export function checkedFen(value) {
  if (typeof value !== 'string' || value.length > 256 || /[\r\n\0]/.test(value)) throw new Error('FEN inválida');
  const fen = value.trim().replace(/\s+/g, ' ');
  if (fen.split(' ').length !== 6) throw new Error('Informe os seis campos da FEN');
  const result = validateFen(fen);
  if (!result.ok) throw new Error(result.error);
  return fen;
}

export function checkedMove(value) {
  if (typeof value !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value)) throw new Error('Lance UCI inválido');
  return { from: value.slice(0, 2), to: value.slice(2, 4), ...(value.length === 5 ? { promotion: value[4] } : {}) };
}

export function replayMoves(moves, initialFen) {
  if (!Array.isArray(moves) || moves.length > 10000) throw new Error('Histórico inválido');
  const chess = initialFen ? new Chess(checkedFen(initialFen)) : new Chess();
  for (const move of moves) chess.move(/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) ? checkedMove(move) : move);
  return chess;
}

export function importPosition(text) {
  if (typeof text !== 'string' || text.length > 100000) throw new Error('Posição muito grande');
  if (text.trim().split(/\s+/)[0].includes('/')) return new Chess(checkedFen(text));
  const chess = new Chess();
  chess.loadPgn(text);
  return chess;
}

export function legalMove(fen, uci) {
  try { return new Chess(checkedFen(fen)).move(checkedMove(uci)); } catch { return null; }
}

export function snapshotKey(snapshot) {
  return JSON.stringify([snapshot.gameId, snapshot.variant, snapshot.fen, snapshot.orientation, snapshot.orientationVerified, snapshot.complete, snapshot.active, snapshot.myColor]);
}
