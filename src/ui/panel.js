import css from './styles.css';
import { Chess } from 'chess.js';
import { squareCenter, clampPanel } from '../core/geometry.js';

const ns = 'http://www.w3.org/2000/svg';
const shapes = {
  p: '<circle cx="16" cy="9" r="4"/><path d="M12 14h8l-2 5 5 7H9l5-7z"/>',
  r: '<path d="M8 5h4v4h2V5h4v4h2V5h4v9l-3 3 1 9H10l1-9-3-3z"/>',
  n: '<path d="M10 26h14l-2-5 1-11-5-6-1 4-5 2-5 8 5 2 5-4-3 5z"/><circle cx="18" cy="11" r="1" fill="#50604d"/>',
  b: '<path d="M16 3l7 8-5 7 5 8H9l5-8-5-7z"/><path d="M15 6l4 6" fill="none"/>',
  q: '<path d="M8 10l4 4 4-7 4 7 4-4-3 16H11z"/><circle cx="7" cy="8" r="2"/><circle cx="16" cy="5" r="2"/><circle cx="25" cy="8" r="2"/>',
  k: '<path d="M14 3h4v4h4v4h-4v4l5 3-3 8h-8l-3-8 5-3v-4h-4V7h4z"/>',
};
function icon(piece) {
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<g stroke="' + (piece.color === 'w' ? '#26331e' : '#c0cbb4') + '" stroke-width="1.4" stroke-linejoin="round" fill="' + (piece.color === 'w' ? '#fffbed' : '#26312c') + '">' + shapes[piece.type] + '<path d="M8 28h16" fill="none"/></g>';
  return svg;
}

export function mountPanel({ onAnalyse, onImport, onSync, onPlay, onSettings, onDispose }) {
  const old = document.querySelector('ygp-assist-root');
  if (old) throw new Error('Assistente já montado');
  const host = document.createElement('ygp-assist-root');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = css; shadow.append(style);
  const panel = document.createElement('section');
  panel.className = 'panel'; panel.setAttribute('aria-label', 'Chess YGP Assist');
  panel.innerHTML = '<header><strong>Chess YGP Assist</strong><button data-close aria-label="Minimizar">−</button><button data-dispose aria-label="Encerrar assistente">×</button></header>' +
    '<p class="status" role="status">Conectando ao FlyOrDie…</p><div class="muted source"></div><div class="board" role="img" aria-label="Posição de análise"></div>' +
    '<div class="bestmove">—</div><div class="muted evaluation"></div><div class="row"><button class="primary analyse">Analisar</button><button class="play" disabled>Jogar lance</button><button class="sync">Sincronizar</button></div>' +
    '<div class="row"><label>Profundidade <input class="depth" type="range" min="1" max="24" value="14"><output>14</output></label></div>' +
    '<div class="row"><label><input class="auto" type="checkbox" checked>Análise automática</label><label><input class="arrows" type="checkbox" checked>Setas</label><label><input class="voice" type="checkbox">Voz</label></div>' +
    '<div class="row"><label>Visão do tabuleiro <select class="orientation"><option value="auto">Detectar</option><option value="w">Brancas embaixo</option><option value="b">Pretas embaixo</option></select></label></div>' +
    '<details><summary>Importar posição ou partida</summary><textarea aria-label="FEN ou PGN" spellcheck="false" placeholder="Cole uma FEN completa ou um PGN"></textarea><button class="import">Importar</button><p class="muted">A importação abre uma análise independente da partida online.</p></details>' +
    '<div class="muted engine">Stockfish 19.0.1 · uma thread</div><div class="muted">v0.1.0-alpha.1 · integração FlyOrDie<br><a href="https://github.com/ThatKidGlitchy/chess-hacks" target="_blank" rel="noopener noreferrer">Projeto de origem: Chess Assist</a></div>';
  const bubble = document.createElement('button'); bubble.className = 'bubble'; bubble.textContent = 'YGP'; bubble.setAttribute('aria-label', 'Abrir Chess Assist');
  const layer = document.createElementNS(ns, 'svg'); layer.classList.add('layer'); layer.setAttribute('viewBox', '0 0 100 100');
  shadow.append(layer, panel, bubble);
  document.documentElement.append(host);
  const $ = selector => panel.querySelector(selector);
  const controller = new AbortController(); const events = { signal: controller.signal };
  let orientation = 'w', fen = null, best = null, rect = null;
  const reportError = error => ui.status(error.message || String(error), true);
  $('.analyse').addEventListener('click', () => Promise.resolve(onAnalyse()).catch(reportError), events);
  $('.play').addEventListener('click', () => Promise.resolve(onPlay()).catch(reportError), events);
  $('.sync').addEventListener('click', () => Promise.resolve(onSync()).catch(reportError), events);
  $('.import').addEventListener('click', () => { try { onImport($('textarea').value); } catch(error) { reportError(error); } }, events);
  $('[data-dispose]').addEventListener('click', onDispose, events);
  $('[data-close]').addEventListener('click', () => { panel.hidden = true; }, events);
  bubble.addEventListener('click', () => { panel.hidden = !panel.hidden; clamp(); }, events);
  function settings() { return { depth: Number($('.depth').value), auto: $('.auto').checked, arrows: $('.arrows').checked, voice: $('.voice').checked, orientation:$('.orientation').value }; }
  for (const selector of ['.depth', '.auto', '.arrows', '.voice','.orientation']) $(selector).addEventListener('input', () => { $('output').textContent = $('.depth').value; onSettings(settings()); drawArrow(); }, events);
  function clamp() {
    if (panel.hidden) return;
    const r = panel.getBoundingClientRect();
    const p = clampPanel(r.x, r.y, r.width, r.height, innerWidth, innerHeight);
    panel.style.left = p.x + 'px'; panel.style.top = p.y + 'px'; panel.style.right = 'auto';
  }
  let drag = null;
  const header = $('header');
  header.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const r = panel.getBoundingClientRect(); drag = { x: e.clientX - r.x, y: e.clientY - r.y };
    header.setPointerCapture(e.pointerId); e.preventDefault();
  }, events);
  header.addEventListener('pointermove', e => { if (!drag) return; panel.style.left = e.clientX - drag.x + 'px'; panel.style.top = e.clientY - drag.y + 'px'; panel.style.right = 'auto'; clamp(); }, events);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) header.addEventListener(type, () => { drag = null; }, events);
  window.addEventListener('resize', clamp, events);
  window.visualViewport?.addEventListener('resize', clamp, events);
  function drawArrow() {
    layer.replaceChildren();
    layer.style.display = best && rect && $('.arrows').checked ? '' : 'none';
    if (!best || !rect || !$('.arrows').checked) return;
    const a = squareCenter(best.move.slice(0,2), { x:0,y:0,width:100,height:100 }, orientation);
    const b = squareCenter(best.move.slice(2,4), { x:0,y:0,width:100,height:100 }, orientation);
    Object.assign(layer.style, { left: rect.x+'px', top: rect.y+'px', width: rect.width+'px', height: rect.height+'px' });
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
    const pts=[[a.x+nx*1.2,a.y+ny*1.2],[b.x-ux*5+nx*1.2,b.y-uy*5+ny*1.2],[b.x-ux*5+nx*3.5,b.y-uy*5+ny*3.5],[b.x,b.y],[b.x-ux*5-nx*3.5,b.y-uy*5-ny*3.5],[b.x-ux*5-nx*1.2,b.y-uy*5-ny*1.2],[a.x-nx*1.2,a.y-ny*1.2]];
    const polygon=document.createElementNS(ns,'polygon');polygon.setAttribute('points',pts.map(p=>p.join(',')).join(' '));polygon.setAttribute('fill','#a3d16c');polygon.setAttribute('opacity','.82');layer.append(polygon);
  }
  function drawBoard() {
    const board = $('.board'); board.replaceChildren();
    if (!fen) return;
    const chess = new Chess(fen);
    for(let r=0;r<8;r++) for(let c=0;c<8;c++) {
      const file=orientation==='w'?c:7-c, rank=orientation==='w'?8-r:r+1;
      const square=String.fromCharCode(97+file)+rank, cell=document.createElement('div');
      cell.className='square'+((file+rank)%2===0?' dark':'')+(best&&(best.move.startsWith(square)||best.move.slice(2,4)===square)?' best':'');
      cell.dataset.square=square;
      const piece=chess.get(square); if(piece)cell.append(icon(piece));
      const label=document.createElement('span');label.className='coord';label.textContent=square;cell.append(label);board.append(cell);
    }
  }
  const ui = {
    host, shadow,
    settings,
    setPanelHidden(value){const previous=panel.hidden;panel.hidden=!!value;if(!value)clamp();return previous;},
    restoreSettings(value) {
      if(!value||typeof value!=='object')return;
      if(Number.isInteger(value.depth)&&value.depth>=1&&value.depth<=24){$('.depth').value=value.depth;$('output').textContent=value.depth;}
      for(const key of ['auto','arrows','voice'])if(typeof value[key]==='boolean')$('.'+key).checked=value[key];
      if(['auto','w','b'].includes(value.orientation))$('.orientation').value=value.orientation;
    },
    status(text, error=false) { $('.status').textContent=text;$('.status').classList.toggle('error',error); },
    source(text) { $('.source').textContent=text; },
    engine(text) { $('.engine').textContent=text; },
    position(snapshot) { fen=snapshot?.fen||null;orientation=snapshot?.orientation||'w';best=null;$('.bestmove').textContent='—';$('.evaluation').textContent='';$('.analyse').disabled=!fen;$('.play').disabled=true;drawBoard();drawArrow(); },
    geometry(value, side) { rect=value;orientation=side||orientation;drawArrow(); },
    result(value, canPlay) { best=value;$('.bestmove').textContent=value?value.san+' · '+value.move:'Fim da partida';$('.evaluation').textContent=value?(value.mate!==null&&value.mate!==undefined?'Mate em '+value.mate:value.cp!==null?'Avaliação: '+(value.cp/100).toFixed(2)+' para quem joga':'')+' · profundidade '+value.depth:'';$('.play').disabled=!value||!canPlay;drawBoard();drawArrow(); },
    busy(value) { $('.analyse').disabled=value||!fen;$('.play').disabled=true; },
    dispose() { controller.abort();observer.disconnect();host.remove(); },
  };
  const observer=new ResizeObserver(clamp);observer.observe(panel);clamp();
  return ui;
}
