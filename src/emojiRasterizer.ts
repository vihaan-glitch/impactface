import type { EmotionKey } from './emotions'

export interface PixelTarget {
  x: number
  y: number
}

const RASTER_SIZE     = 64
const DISPLAY_SIZE    = 280
const ALPHA_THRESHOLD = 64

export const EMOTION_EMOJI: Record<EmotionKey, string> = {
  joy:      '😄',
  anger:    '😠',
  fear:     '😨',
  sadness:  '😢',
  surprise: '😲',
}

const EMOJI_TO_EMOTION: Record<string, EmotionKey> = Object.fromEntries(
  Object.entries(EMOTION_EMOJI).map(([k, v]) => [v, k])
) as Record<string, EmotionKey>

// Render a procedural face for the given emoji, returning pixel targets in main-canvas space.
// Color emoji in canvas are fully opaque across the entire face glyph, making alpha-channel
// reading useless for distinguishing emotions. Procedural geometry gives distinct, reliable shapes.
export function rasterizeEmoji(
  emoji: string,
  centerX: number,
  centerY: number,
): PixelTarget[] {
  const emotion = EMOJI_TO_EMOTION[emoji] ?? 'joy'

  const offscreen = document.createElement('canvas')
  offscreen.width  = RASTER_SIZE
  offscreen.height = RASTER_SIZE
  const ctx = offscreen.getContext('2d')!

  const cx = RASTER_SIZE / 2
  const cy = RASTER_SIZE / 2
  const r  = RASTER_SIZE * 0.42

  ctx.strokeStyle = 'white'
  ctx.fillStyle   = 'white'
  ctx.lineWidth   = Math.max(1.5, r * 0.09)
  ctx.lineCap     = 'round'

  drawFace(ctx, emotion, cx, cy, r)

  const { data } = ctx.getImageData(0, 0, RASTER_SIZE, RASTER_SIZE)
  const scale     = DISPLAY_SIZE / RASTER_SIZE
  const targets: PixelTarget[] = []

  for (let py = 0; py < RASTER_SIZE; py++) {
    for (let px = 0; px < RASTER_SIZE; px++) {
      if (data[(py * RASTER_SIZE + px) * 4 + 3] > ALPHA_THRESHOLD) {
        targets.push({
          x: centerX + (px - RASTER_SIZE / 2) * scale,
          y: centerY + (py - RASTER_SIZE / 2) * scale,
        })
      }
    }
  }

  return targets
}

function drawFace(ctx: CanvasRenderingContext2D, emotion: string, cx: number, cy: number, r: number) {
  // Face outline
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  const ex = r * 0.32          // eye x offset from center
  const ey = cy - r * 0.18    // eye y
  const er = r * 0.09          // eye radius

  switch (emotion) {
    case 'joy':
      dot(ctx, cx - ex, ey, er)
      dot(ctx, cx + ex, ey, er)
      // Smile: bottom semicircle
      ctx.beginPath()
      ctx.arc(cx, cy + r * 0.12, r * 0.42, 0, Math.PI)
      ctx.stroke()
      break

    case 'anger':
      dot(ctx, cx - ex, ey, er * 0.85)
      dot(ctx, cx + ex, ey, er * 0.85)
      // Brows angled down toward nose
      line(ctx, cx - ex - r * 0.18, ey - r * 0.22, cx - ex + r * 0.06, ey - r * 0.09)
      line(ctx, cx + ex + r * 0.18, ey - r * 0.22, cx + ex - r * 0.06, ey - r * 0.09)
      // Frown: top semicircle
      ctx.beginPath()
      ctx.arc(cx, cy + r * 0.45, r * 0.32, Math.PI, 2 * Math.PI)
      ctx.stroke()
      break

    case 'fear':
      // Wide eyes
      dot(ctx, cx - ex, ey, er * 1.4)
      dot(ctx, cx + ex, ey, er * 1.4)
      // Raised brows arching up
      line(ctx, cx - ex - r * 0.14, ey - r * 0.17, cx - ex + r * 0.14, ey - r * 0.25)
      line(ctx, cx + ex - r * 0.14, ey - r * 0.25, cx + ex + r * 0.14, ey - r * 0.17)
      // Open oval mouth
      ctx.beginPath()
      ctx.ellipse(cx, cy + r * 0.42, r * 0.18, r * 0.24, 0, 0, Math.PI * 2)
      ctx.stroke()
      break

    case 'sadness':
      dot(ctx, cx - ex, ey, er)
      dot(ctx, cx + ex, ey, er)
      // Teardrops
      teardrop(ctx, cx - ex, ey + er, r * 0.07, r * 0.17)
      teardrop(ctx, cx + ex, ey + er, r * 0.07, r * 0.17)
      // Frown: top semicircle
      ctx.beginPath()
      ctx.arc(cx, cy + r * 0.45, r * 0.32, Math.PI, 2 * Math.PI)
      ctx.stroke()
      break

    case 'surprise':
      // Wide eyes
      dot(ctx, cx - ex, ey, er * 1.3)
      dot(ctx, cx + ex, ey, er * 1.3)
      // Raised brow arches
      ctx.beginPath()
      ctx.arc(cx - ex, ey - r * 0.22, r * 0.18, Math.PI, 0)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx + ex, ey - r * 0.22, r * 0.18, Math.PI, 0)
      ctx.stroke()
      // O-shaped mouth
      ctx.beginPath()
      ctx.arc(cx, cy + r * 0.42, r * 0.2, 0, Math.PI * 2)
      ctx.stroke()
      break
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function teardrop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath()
  ctx.ellipse(x, y + h * 0.5, w, h * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
}
