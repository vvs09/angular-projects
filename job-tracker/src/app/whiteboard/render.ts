import { BOARD_H, BOARD_W, Stroke } from './whiteboard.model';

/** Draws a stroke as a smooth curve through the midpoints of its samples. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const p = stroke.points;
  if (p.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (p.length === 2) {
    // A tap leaves a dot.
    ctx.beginPath();
    ctx.arc(p[0], p[1], stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length - 2; i += 2) {
      ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
    }
    ctx.lineTo(p[p.length - 2], p[p.length - 1]);
    ctx.stroke();
  }
  ctx.restore();
}

/** Renders the board to a PNG on white. Strokes go on their own layer first so the eraser can't punch through the background. */
export function exportPng(strokes: Iterable<Stroke>, scale = 2): Promise<Blob | null> {
  const layer = document.createElement('canvas');
  layer.width = BOARD_W * scale;
  layer.height = BOARD_H * scale;
  const layerCtx = layer.getContext('2d')!;
  layerCtx.scale(scale, scale);
  for (const stroke of strokes) drawStroke(layerCtx, stroke);

  const out = document.createElement('canvas');
  out.width = layer.width;
  out.height = layer.height;
  const outCtx = out.getContext('2d')!;
  outCtx.fillStyle = '#ffffff';
  outCtx.fillRect(0, 0, out.width, out.height);
  outCtx.drawImage(layer, 0, 0);
  return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
}
