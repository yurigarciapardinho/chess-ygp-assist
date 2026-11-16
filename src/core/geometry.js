export function squareCenter(square, rect, orientation = 'w') {
  if (!/^[a-h][1-8]$/.test(square)) throw new Error('Casa inválida');
  if (!rect || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(rect[k])) || rect.width <= 0 || rect.height <= 0) throw new Error('Geometria indisponível');
  if (orientation !== 'w' && orientation !== 'b') throw new Error('Orientação desconhecida');
  let column = square.charCodeAt(0) - 97;
  let row = 8 - Number(square[1]);
  if (orientation === 'b') { column = 7 - column; row = 7 - row; }
  return { x: rect.x + (column + 0.5) * rect.width / 8, y: rect.y + (row + 0.5) * rect.height / 8 };
}

export function clampPanel(x, y, width, height, viewportWidth, viewportHeight) {
  return { x: Math.max(8, Math.min(x, Math.max(8, viewportWidth - width - 8))), y: Math.max(8, Math.min(y, Math.max(8, viewportHeight - height - 8))) };
}

export function frameOffset(frameWindow, outerWindow) {
  let x = 0, y = 0, scaleX=1, scaleY=1, current = frameWindow;
  while (current !== outerWindow) {
    const element = current.frameElement;
    if (!element) throw new Error('Frame fora da origem acessível');
    const r = element.getBoundingClientRect();
    if(!element.offsetWidth||!element.offsetHeight)throw new Error('Frame oculto');
    const sx=r.width/element.offsetWidth,sy=r.height/element.offsetHeight;
    const transform=current.parent.getComputedStyle?.(element).transform;
    if(transform&&transform!=='none'&&current.parent.DOMMatrix){const matrix=new current.parent.DOMMatrix(transform);if(Math.abs(matrix.b)+Math.abs(matrix.c)>.001)throw new Error('Frame rotacionado não suportado');}
    x=r.x+(element.clientLeft+x)*sx;y=r.y+(element.clientTop+y)*sy;scaleX*=sx;scaleY*=sy;
    current = current.parent;
  }
  return { x, y, scaleX, scaleY };
}
