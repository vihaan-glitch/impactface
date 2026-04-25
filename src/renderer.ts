import { ctx } from './canvas'
import type { Asteroid } from './asteroids'

const SPECTRAL_COLORS: Record<string, string> = {
  C: '#4a4a4a',
  G: '#5a5a3a',
  B: '#4a5060',
  S: '#8a6a4a',
  M: '#9a9a9a',
  X: '#5a5a5a',
  D: '#6a4a3a',
  P: '#3a4a3a',
}

function spectralColor(cls: string): string {
  return SPECTRAL_COLORS[cls?.[0]?.toUpperCase()] ?? '#606060'
}

export function visualRadius(diameterKm: number): number {
  return 10 + Math.log(diameterKm + 1) * 5.5
}

// Deterministic LCG seeded on a string
function makeLCG(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return () => {
    h = (Math.imul(1664525, h) + 1013904223) | 0
    return (h >>> 0) / 0x100000000
  }
}

// Build an irregular polygon path using Fourier-harmonic radial deformation
function irregularPath(rng: () => number, r: number, segments = 48) {
  // 3–4 harmonics for a believably lumpy rock
  const harmonics = [
    { freq: 2, amp: rng() * 0.12 + 0.04, phase: rng() * Math.PI * 2 },
    { freq: 3, amp: rng() * 0.09 + 0.02, phase: rng() * Math.PI * 2 },
    { freq: 5, amp: rng() * 0.06 + 0.01, phase: rng() * Math.PI * 2 },
    { freq: 7, amp: rng() * 0.04,         phase: rng() * Math.PI * 2 },
  ]

  ctx.beginPath()
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    let rad = r
    for (const h of harmonics) rad += r * h.amp * Math.sin(h.freq * theta + h.phase)
    const x = Math.cos(theta) * rad
    const y = Math.sin(theta) * rad
    if (i === 0) { ctx.moveTo(x, y) } else { ctx.lineTo(x, y) }
  }
  ctx.closePath()
}

export function drawAsteroid(asteroid: Asteroid, x: number, y: number) {
  const r     = visualRadius(asteroid.diameterKm)
  const color = spectralColor(asteroid.spectralClass)
  const rng   = makeLCG(asteroid.id)

  ctx.save()
  ctx.translate(x, y)

  // Outer dust halo
  const halo = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.8)
  halo.addColorStop(0, 'rgba(180,160,120,0.07)')
  halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2)
  ctx.fillStyle = halo
  ctx.fill()

  // Save clip for texture layer
  ctx.save()
  irregularPath(rng, r)
  ctx.clip()

  // Base body gradient — light from upper-left
  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.05, r * 0.1, r * 0.1, r * 1.3)
  body.addColorStop(0,   lighten(color, 55))
  body.addColorStop(0.4, color)
  body.addColorStop(0.75, darken(color, 20))
  body.addColorStop(1,   darken(color, 50))
  ctx.fillStyle = body
  ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4)

  // Fine noise-texture stripes (simulate regolith)
  const rng2 = makeLCG(asteroid.id + '_tex')
  for (let i = 0; i < 18; i++) {
    const tx = (rng2() - 0.5) * r * 2
    const ty = (rng2() - 0.5) * r * 2
    const tr = rng2() * r * 0.6 + r * 0.1
    const ta = rng2() * 0.06
    const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, tr)
    grad.addColorStop(0, `rgba(0,0,0,${ta})`)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(tx, ty, tr, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
  }

  // Craters
  const rng3 = makeLCG(asteroid.id + '_cr')
  const count = 3 + Math.floor(rng3() * 5)
  for (let i = 0; i < count; i++) {
    const angle = rng3() * Math.PI * 2
    const dist  = rng3() * r * 0.6
    const cr    = r * (0.05 + rng3() * 0.15)
    const cx    = Math.cos(angle) * dist
    const cy    = Math.sin(angle) * dist
    // Crater shadow
    ctx.beginPath()
    ctx.arc(cx, cy, cr, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(0,0,0,${0.3 + rng3() * 0.25})`
    ctx.fill()
    // Rim highlight
    ctx.beginPath()
    ctx.arc(cx - cr * 0.25, cy - cr * 0.25, cr * 0.55, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${0.05 + rng3() * 0.06})`
    ctx.fill()
  }

  // Terminator shadow (dark limb on right side)
  const shadow = ctx.createRadialGradient(r * 0.5, r * 0.3, r * 0.4, r * 0.6, r * 0.4, r * 1.4)
  shadow.addColorStop(0, 'rgba(0,0,0,0)')
  shadow.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = shadow
  ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4)

  ctx.restore()  // un-clip

  // Rim specular highlight (top-left edge)
  const specR = r * 1.02
  const spec = ctx.createRadialGradient(-specR * 0.45, -specR * 0.45, specR * 0.3, 0, 0, specR)
  spec.addColorStop(0,   'rgba(255,255,240,0.18)')
  spec.addColorStop(0.5, 'rgba(255,255,240,0.04)')
  spec.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.arc(0, 0, specR, 0, Math.PI * 2)
  ctx.fillStyle = spec
  ctx.fill()

  // Name label
  const fontSize = Math.max(10, r * 0.52)
  ctx.fillStyle = 'rgba(220,220,220,0.9)'
  ctx.font = `${fontSize}px "Courier New", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(asteroid.name, 0, r + 7)

  // Diameter sub-label
  ctx.fillStyle = 'rgba(150,150,150,0.6)'
  ctx.font = `9px "Courier New", monospace`
  ctx.fillText(`${asteroid.diameterKm.toFixed(0)} km`, 0, r + 7 + fontSize + 2)

  ctx.restore()
}

function lighten(hex: string, amount: number): string {
  return adjustColor(hex, amount)
}
function darken(hex: string, amount: number): string {
  return adjustColor(hex, -amount)
}
function adjustColor(hex: string, amount: number): string {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount))
  return `rgb(${r},${g},${b})`
}
