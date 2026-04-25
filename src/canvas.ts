export const canvas = document.getElementById('simulation') as HTMLCanvasElement
export const ctx = canvas.getContext('2d')!

// Stars are fixed — generate once, redraw each frame
interface Star {
  x: number
  y: number
  radius: number
  opacity: number
}

let stars: Star[] = []

function generateStars(count: number) {
  stars = []
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.2,
      opacity: 0.3 + Math.random() * 0.7,
    })
  }
}

const SIDEBAR_WIDTH      = 340
export const LEFT_SIDEBAR_WIDTH = 240

export function resizeCanvas() {
  canvas.width  = window.innerWidth - SIDEBAR_WIDTH - LEFT_SIDEBAR_WIDTH
  canvas.height = window.innerHeight
  generateStars(300)
}

export function drawBackground() {
  // Deep space black
  ctx.fillStyle = '#000005'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Stars
  for (const star of stars) {
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`
    ctx.fill()
  }
}
