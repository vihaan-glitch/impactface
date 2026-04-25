export const canvas = document.getElementById('simulation') as HTMLCanvasElement
export const ctx = canvas.getContext('2d')!

interface Star  { x: number; y: number; radius: number; opacity: number }
interface Cloud { x: number; y: number; size: number }

let stars:  Star[]  = []
let clouds: Cloud[] = []

function generateStars(count: number) {
  stars = []
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius:  Math.random() * 1.2,
      opacity: 0.3 + Math.random() * 0.7,
    })
  }
}

function generateClouds(count: number) {
  clouds = []
  for (let i = 0; i < count; i++) {
    clouds.push({
      x:    Math.random() * canvas.width,
      y:    60 + Math.random() * canvas.height * 0.38,
      size: 28 + Math.random() * 55,
    })
  }
}

const SIDEBAR_WIDTH      = 340
export const LEFT_SIDEBAR_WIDTH = 240

export function resizeCanvas() {
  canvas.width  = window.innerWidth - SIDEBAR_WIDTH - LEFT_SIDEBAR_WIDTH
  canvas.height = window.innerHeight
  generateStars(300)
  generateClouds(6)
}

// ── Background selection ──────────────────────────────────────────────────────
export type BackgroundKey = 'space' | 'sky' | 'sunset' | 'aurora' | 'nebula'
let activeBackground: BackgroundKey = 'space'

export function setBackground(key: BackgroundKey) {
  activeBackground = key
}

export function drawBackground() {
  switch (activeBackground) {
    case 'space':  drawSpace();  break
    case 'sky':    drawSky();    break
    case 'sunset': drawSunset(); break
    case 'aurora': drawAurora(); break
    case 'nebula': drawNebula(); break
  }
}

function drawSpace() {
  ctx.fillStyle = '#000005'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (const s of stars) {
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${s.opacity})`
    ctx.fill()
  }
}

function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
  grad.addColorStop(0,   '#1a5fa8')
  grad.addColorStop(0.5, '#5aace0')
  grad.addColorStop(1,   '#b8dffa')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Sun
  const sx = canvas.width * 0.78, sy = canvas.height * 0.11
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 90)
  sun.addColorStop(0,   'rgba(255,255,210,1)')
  sun.addColorStop(0.2, 'rgba(255,230,100,0.9)')
  sun.addColorStop(1,   'rgba(255,210,60,0)')
  ctx.beginPath(); ctx.arc(sx, sy, 90, 0, Math.PI * 2)
  ctx.fillStyle = sun; ctx.fill()

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  for (const c of clouds) drawCloud(c.x, c.y, c.size)
}

function drawCloud(x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.arc(x,           y,           s,        0, Math.PI * 2)
  ctx.arc(x + s * 0.8, y - s * 0.2, s * 0.7,  0, Math.PI * 2)
  ctx.arc(x - s * 0.7, y + s * 0.1, s * 0.55, 0, Math.PI * 2)
  ctx.arc(x + s * 1.4, y + s * 0.1, s * 0.5,  0, Math.PI * 2)
  ctx.fill()
}

function drawSunset() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
  grad.addColorStop(0,    '#0d0d2b')
  grad.addColorStop(0.3,  '#1a0a3d')
  grad.addColorStop(0.62, '#7b2d00')
  grad.addColorStop(0.82, '#e05a1c')
  grad.addColorStop(1,    '#ff9640')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (const s of stars) {
    if (s.y < canvas.height * 0.48) {
      ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${s.opacity * 0.65})`; ctx.fill()
    }
  }

  const hg = ctx.createRadialGradient(canvas.width / 2, canvas.height, 0, canvas.width / 2, canvas.height, canvas.width * 0.65)
  hg.addColorStop(0, 'rgba(255,150,50,0.22)')
  hg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = hg; ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function drawAurora() {
  ctx.fillStyle = '#020b14'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (const s of stars) {
    ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${s.opacity * 0.45})`; ctx.fill()
  }

  const t = performance.now() / 3000
  const bands: [string, number][] = [
    ['0,255,120',  0.13],
    ['60,200,255', 0.26],
    ['180,80,255', 0.39],
  ]

  for (let b = 0; b < bands.length; b++) {
    const [rgb, yFrac] = bands[b]
    const baseY = canvas.height * yFrac
    const bandH = canvas.height * 0.13

    ctx.beginPath(); ctx.moveTo(0, baseY)
    for (let x = 0; x <= canvas.width; x += 6) {
      const wave = Math.sin(x / canvas.width * Math.PI * 4 + t + b * 1.5) * 28
                 + Math.sin(x / canvas.width * Math.PI * 7 + t * 1.3 + b) * 13
      ctx.lineTo(x, baseY + wave)
    }
    ctx.lineTo(canvas.width, baseY + bandH)
    ctx.lineTo(0, baseY + bandH)
    ctx.closePath()

    const gl = ctx.createLinearGradient(0, baseY - 10, 0, baseY + bandH + 10)
    gl.addColorStop(0,   `rgba(${rgb},0)`)
    gl.addColorStop(0.5, `rgba(${rgb},0.18)`)
    gl.addColorStop(1,   `rgba(${rgb},0)`)
    ctx.fillStyle = gl; ctx.fill()
  }
}

function drawNebula() {
  ctx.fillStyle = '#050010'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const nebulae: [number, number, number, string][] = [
    [0.2,  0.3,  0.38, '80,20,160'],
    [0.72, 0.38, 0.30, '20,60,170'],
    [0.5,  0.72, 0.32, '160,20,80'],
    [0.15, 0.68, 0.24, '20,130,110'],
  ]
  for (const [fx, fy, fr, rgb] of nebulae) {
    const nx = fx * canvas.width, ny = fy * canvas.height
    const nr = fr * Math.max(canvas.width, canvas.height)
    const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr)
    g.addColorStop(0,   `rgba(${rgb},0.2)`)
    g.addColorStop(0.5, `rgba(${rgb},0.08)`)
    g.addColorStop(1,   `rgba(${rgb},0)`)
    ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2)
    ctx.fillStyle = g; ctx.fill()
  }

  for (const s of stars) {
    ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${s.opacity})`; ctx.fill()
  }
}
