import { checkedFen, legalMove } from '../core/position.js';
import manifest from './manifest.json' with { type: 'json' };

export async function verifiedBytes(bytes, asset) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== asset.bytes) throw new Error('Tamanho inesperado do motor');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
  if (digest !== asset.sha256) throw new Error('Integridade SHA-256 do motor inválida');
  return bytes;
}

export async function verifiedAsset(asset, fetcher = fetch) {
  const url = new URL(asset.url);
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.jsdelivr.net' || !url.pathname.startsWith('/npm/stockfish@19.0.1/bin/')) throw new Error('Origem do motor não permitida');
  const response = await fetcher(url.href, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error('Motor: HTTP ' + response.status);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > asset.bytes) throw new Error('Tamanho inesperado do motor');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  if (size !== asset.bytes) throw new Error('Download incompleto do motor');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return verifiedBytes(bytes, asset);
}

export function parseInfo(line) {
  const pv = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)(?:\s|$)/);
  if (!pv || /\bmultipv\s+([2-9]|\d{2,})\b/.test(line)) return null;
  const score = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  const depth = line.match(/\bdepth\s+(\d+)/);
  return { move: pv[1], cp: score?.[1] === 'cp' ? Number(score[2]) : null, mate: score?.[1] === 'mate' ? Number(score[2]) : null, depth: depth ? Number(depth[1]) : 0 };
}

export class UciEngine {
  worker = null;
  urls = [];
  listeners = new Set();
  initialising = null;
  queue = Promise.resolve();
  name = '';
  closed = false;
  constructor({ onProgress = () => {}, onInfo = () => {}, assets = null } = {}) { this.onProgress = onProgress; this.onInfo = onInfo; this.assets = assets; }
  async start() {
    if (this.closed) throw new Error('Motor encerrado');
    if (this.worker) return;
    if (this.initialising) return this.initialising;
    this.initialising = this.#start().catch(error => { this.dispose(error); throw error; });
    return this.initialising;
  }
  async #start() {
    this.onProgress('Verificando Stockfish 19.0.1…');
    const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
    const [js, wasm] = await Promise.all(this.assets
      ? [verifiedBytes(decode(this.assets.js),manifest.js),verifiedBytes(decode(this.assets.wasm),manifest.wasm)]
      : [verifiedAsset(manifest.js),verifiedAsset(manifest.wasm)]);
    if (this.closed) throw new Error('Motor encerrado');
    const jsUrl = URL.createObjectURL(new Blob([js], { type: 'application/javascript' }));
    const wasmUrl = URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));
    const boot = URL.createObjectURL(new Blob(['importScripts(' + JSON.stringify(jsUrl) + ');'], { type: 'application/javascript' }));
    this.urls.push(jsUrl, wasmUrl, boot);
    this.worker = new Worker(boot + '#' + encodeURIComponent(wasmUrl));
    this.worker.onmessage = event => {
      if (typeof event.data !== 'string') return;
      for (const raw of event.data.split(/\r?\n/)) {
        const line = raw.trim();
        if (line.startsWith('id name ')) this.name = line.slice(8);
        for (const listener of [...this.listeners]) listener(line);
      }
    };
    this.worker.onerror = () => this.dispose(new Error('O Worker do motor falhou'));
    this.worker.onmessageerror = () => this.dispose(new Error('Mensagem inválida do motor'));
    await this.wait(/^uciok$/, () => this.worker.postMessage('uci'), 20000);
    this.worker.postMessage('setoption name Hash value 32');
    this.worker.postMessage('setoption name MultiPV value 1');
    await this.wait(/^readyok$/, () => this.worker.postMessage('isready'));
    this.onProgress(this.name || 'Stockfish pronto');
  }
  wait(pattern, action, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const finish = (error, line) => { clearTimeout(timer); this.listeners.delete(listener); this.pending.delete(finish); error ? reject(error) : resolve(line); };
      const listener = line => { if (pattern.test(line)) finish(null, line); };
      const timer = setTimeout(() => this.dispose(new Error('Motor sem resposta: ' + pattern.source)), timeout);
      this.pending.add(finish);
      this.listeners.add(listener);
      try { action(); } catch (error) { finish(error); }
    });
  }
  pending = new Set();
  analyse(fen, { depth = 14, signal } = {}) {
    fen = checkedFen(fen);
    if (!Number.isInteger(depth) || depth < 1 || depth > 24) return Promise.reject(new Error('Profundidade inválida'));
    const run = async () => {
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      await this.start();
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      await this.wait(/^readyok$/, () => this.worker.postMessage('isready'));
      let latest = null;
      const observe = line => { const parsed = parseInfo(line); if (parsed) { latest = parsed; this.onInfo(parsed); } };
      const stop = () => this.worker?.postMessage('stop');
      signal?.addEventListener('abort', stop, { once: true });
      this.listeners.add(observe);
      try {
        const line = await this.wait(/^bestmove\s/, () => {
          this.worker.postMessage('position fen ' + fen);
          this.worker.postMessage('go depth ' + depth);
        }, 60000);
        if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
        const best = line.split(/\s+/)[1];
        if (best === '(none)' || best === '0000') return null;
        const move = legalMove(fen, best);
        if (!move) throw new Error('O motor retornou um lance ilegal para a posição');
        return { ...latest, move: best, san: move.san, engine: this.name };
      } finally { this.listeners.delete(observe); signal?.removeEventListener('abort', stop); }
    };
    const request = this.queue.catch(() => {}).then(run);
    this.queue = request;
    return request;
  }
  dispose(error = new Error('Motor encerrado')) {
    this.closed = true;
    this.worker?.terminate();
    this.worker = null;
    for (const finish of [...this.pending]) finish(error);
    this.listeners.clear();
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.length = 0;
  }
}
