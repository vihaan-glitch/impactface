import { ctx } from './canvas'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  ax: number      // acceleration this frame — written by computeGravity, read by Verlet
  ay: number
  mass: number    // simulation mass units (real kg injected in Phase 13)
  radius: number
  color: string
  alpha: number
  age: number
  maxAge: number
  targetX: number | null
  targetY: number | null
  goalAge:  number
  locked:   boolean
}

export const physics = {
  G_SIM:        50000,
  SOFTENING:    5,
  GOAL_K:       15,
  DRIFT_DELAY:  1.0,
  RAMP_DURATION: 3.0,
  BURST_DAMP:   0.985,
  FORM_DAMP:    0.96,
}

// Keep named exports so existing callers don't break
export const DRIFT_DELAY   = physics.DRIFT_DELAY
export const RAMP_DURATION = physics.RAMP_DURATION

const FRAGMENT_COLORS = [
  'rgb(255,255,220)',  // hot white
  'rgb(255,220,120)',  // yellow
  'rgb(255,160,60)',   // orange
  'rgb(200,80,30)',    // deep orange
  'rgb(140,140,140)',  // grey rock
]

let particles: Particle[] = []

export function spawnParticles(
  x: number,
  y: number,
  count: number,
  speed: number,
  color: string,
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const mag   = speed * (0.4 + Math.random() * 0.8)
    particles.push({
      x,
      y,
      vx:     Math.cos(angle) * mag,
      vy:     Math.sin(angle) * mag,
      ax:     0,
      ay:     0,
      mass:   1.0,
      radius: 1.5 + Math.random() * 2.5,
      color,
      alpha:   1,
      age:     0,
      maxAge:  180 + Math.floor(Math.random() * 120),
      targetX: null,
      targetY: null,
      goalAge: 0,
      locked:  false,
    })
  }
}

// Short-lived debris — visual only, no targets, fades quickly
export function spawnFragments(x: number, y: number, count: number, speed: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const mag   = speed * (0.2 + Math.random() * 1.1)
    const color = FRAGMENT_COLORS[Math.floor(Math.random() * FRAGMENT_COLORS.length)]
    particles.push({
      x, y,
      vx:      Math.cos(angle) * mag,
      vy:      Math.sin(angle) * mag,
      ax: 0, ay: 0,
      mass:    0.2 + Math.random() * 0.3,  // light — less gravity pull
      radius:  0.5 + Math.random() * 1.2,
      color,
      alpha:   1,
      age:     0,
      maxAge:  40 + Math.floor(Math.random() * 50),  // 0.7–1.5 s at 60 fps
      targetX: null,
      targetY: null,
      goalAge: 0,
      locked:  false,
    })
  }
}

// Compute pairwise gravitational acceleration for every particle.
// Uses Newton's third law: if A pulls B with force F, B pulls A with -F.
// This lets us do N*(N-1)/2 pairs instead of N² — twice as fast.
function computeGravity(newAx: Float64Array, newAy: Float64Array) {
  const n = particles.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pi = particles[i]
      const pj = particles[j]
      // Particles in formation mode steer via goal force only — skip gravity
      if (pi.targetX !== null || pj.targetX !== null) continue
      const dx = pj.x - pi.x
      const dy = pj.y - pi.y

      // Softened distance squared: avoids r→0 blowup
      const r2 = dx * dx + dy * dy + physics.SOFTENING * physics.SOFTENING
      const r  = Math.sqrt(r2)
      const r3 = r2 * r

      // Acceleration on i toward j: G * mj * dx / r³
      // Acceleration on j toward i: G * mi * (-dx) / r³
      const factor = physics.G_SIM / r3
      newAx[i] += factor * pj.mass * dx
      newAy[i] += factor * pj.mass * dy
      newAx[j] -= factor * pi.mass * dx
      newAy[j] -= factor * pi.mass * dy
    }
  }
}

// Velocity Verlet — three separate passes:
//   1. Update all positions   (uses acceleration from previous frame)
//   2. Compute all new forces (uses updated positions)
//   3. Update all velocities  (averages old and new acceleration)
export function updateParticles(dt: number) {
  const n = particles.length
  if (n === 0) return

  // Pass 1 — positions
  for (const p of particles) {
    if (p.locked) continue
    p.x += p.vx * dt + 0.5 * p.ax * dt * dt
    p.y += p.vy * dt + 0.5 * p.ay * dt * dt
  }

  // Pass 2 — forces at new positions
  const newAx = new Float64Array(n)
  const newAy = new Float64Array(n)
  computeGravity(newAx, newAy)

  // Goal spring: silent during DRIFT_DELAY, then ramps 0→1 over RAMP_DURATION
  for (let i = 0; i < n; i++) {
    const p = particles[i]
    if (p.targetX !== null && p.targetY !== null && !p.locked) {
      const ramp = Math.max(0, Math.min(1, (p.goalAge - physics.DRIFT_DELAY) / physics.RAMP_DURATION))
      newAx[i] += physics.GOAL_K * ramp * (p.targetX - p.x)
      newAy[i] += physics.GOAL_K * ramp * (p.targetY - p.y)
    }
  }

  // Pass 3 — velocities + aging
  const LOCK_RADIUS = 4  // pixels — snap and freeze when this close to target
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]

    if (p.locked) continue  // frozen — nothing to update

    p.vx += 0.5 * (p.ax + newAx[i]) * dt
    p.vy += 0.5 * (p.ay + newAy[i]) * dt
    p.ax  = newAx[i]
    p.ay  = newAy[i]

    if (p.targetX !== null) {
      const dx = p.x - p.targetX
      const dy = p.y - p.targetY!
      if (dx * dx + dy * dy < LOCK_RADIUS * LOCK_RADIUS) {
        p.x = p.targetX; p.y = p.targetY!
        p.vx = 0; p.vy = 0; p.ax = 0; p.ay = 0
        p.locked = true
      } else {
        // Lighter damping during burst so particles travel further before spring pulls them back
        const damp = p.goalAge < physics.DRIFT_DELAY ? physics.BURST_DAMP : physics.FORM_DAMP
        p.vx     *= damp
        p.vy     *= damp
        p.goalAge += dt
        p.alpha   = 1
      }
    } else {
      p.age  += 1
      p.alpha = 1 - p.age / p.maxAge
      if (p.age >= p.maxAge) particles.splice(i, 1)
    }
  }
}

export function drawParticles() {
  for (const p of particles) {
    ctx.save()

    if (p.locked) {
      // Locked particles glow in their emotion color
      const gr = p.radius * 7
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr)
      glow.addColorStop(0,   rgba(p.color, 0.7))
      glow.addColorStop(0.4, rgba(p.color, 0.2))
      glow.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(p.x, p.y, gr, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()
    } else {
      // Free/homing particles: warm neutral glow
      const gr = p.radius * 3
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr)
      glow.addColorStop(0, `rgba(255,220,160,${p.alpha * 0.4})`)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(p.x, p.y, gr, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    ctx.fillStyle = rgba(p.color, p.alpha)
    ctx.fill()

    ctx.restore()
  }
}

function rgba(rgb: string, alpha: number): string {
  return rgb.replace(/^rgb\(/, 'rgba(').replace(/\)$/, `, ${alpha})`)
}

export function getParticleCount(): number {
  return particles.length
}

export function clearParticles() {
  particles = []
}

export function getParticles(): Particle[] {
  return particles
}

export function getLockedCount(): number {
  return particles.filter(p => p.locked).length
}
