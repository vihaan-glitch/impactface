import './style.css'
import { resizeCanvas, drawBackground, setBackground, canvas, ctx } from './canvas'
import type { BackgroundKey } from './canvas'
import { loadAsteroids, pickCollisionPair, getAllSorted, getById } from './asteroids'
import { drawAsteroid } from './renderer'
import { spawnParticles, spawnFragments, updateParticles, drawParticles, getParticleCount, clearParticles, getParticles, getLockedCount, physics } from './simulation'
import { assignTargets } from './assignment'
import { rasterizeEmoji, EMOTION_EMOJI } from './emojiRasterizer'
import { initCamera, stopCamera, isCameraActive, getVideoElement } from './camera'
import { loadModels, startDetectionLoop, stopDetectionLoop } from './faceDetection'
import { extractScores, pickDominantEmotion, EMOTION_COLORS } from './emotions'
import type { EmotionKey, FaceApiScores } from './emotions'
import type { Asteroid } from './asteroids'
import type { PixelTarget } from './emojiRasterizer'

resizeCanvas()
window.addEventListener('resize', resizeCanvas)

await loadAsteroids()
loadModels()

let [asteroidA, asteroidB] = pickCollisionPair()
let currentEmotion: EmotionKey = 'joy'
let debugTargets: PixelTarget[] = []
let debugTargetsSetAt = 0  // timestamp when last set — for fade-out

// --- Collision state machine ---
type CollisionPhase = 'idle' | 'approaching' | 'impact' | 'forming'
let collisionPhase: CollisionPhase = 'idle'
let phaseStart   = 0
let formingStart = 0

const DWELL_MS = 1500
let dwellEmotion: EmotionKey | null = null
let dwellStart = 0

const MANUAL_OVERRIDE_MS = 5000
let manualOverrideUntil  = 0
const APPROACH_DURATION = 1.5
const IMPACT_DURATION   = 0.25

// ── Asteroid selects ──────────────────────────────────────────────────────────
function populateSelects() {
  const sorted = getAllSorted()
  const selectA = document.getElementById('select-a') as HTMLSelectElement
  const selectB = document.getElementById('select-b') as HTMLSelectElement
  selectA.innerHTML = ''
  selectB.innerHTML = ''
  for (const a of sorted) {
    const label = `${a.name} (${a.diameterKm.toFixed(0)} km)`
    const optA = new Option(label, a.id)
    const optB = new Option(label, a.id)
    selectA.appendChild(optA)
    selectB.appendChild(optB)
  }
  selectA.value = asteroidA.id
  selectB.value = asteroidB.id
}

function syncSelectsToAsteroids() {
  const selectA = document.getElementById('select-a') as HTMLSelectElement
  const selectB = document.getElementById('select-b') as HTMLSelectElement
  selectA.value = asteroidA.id
  selectB.value = asteroidB.id
}

populateSelects()

document.getElementById('select-a')!.addEventListener('change', (e) => {
  const a = getById((e.target as HTMLSelectElement).value)
  if (a) { asteroidA = a; updateAsteroidNames(asteroidA, asteroidB) }
})

document.getElementById('select-b')!.addEventListener('change', (e) => {
  const a = getById((e.target as HTMLSelectElement).value)
  if (a) { asteroidB = a; updateAsteroidNames(asteroidA, asteroidB) }
})

document.getElementById('randomize-btn')!.addEventListener('click', () => {
  ;[asteroidA, asteroidB] = pickCollisionPair()
  updateAsteroidNames(asteroidA, asteroidB)
  syncSelectsToAsteroids()
})

// ── Asteroid info panel ───────────────────────────────────────────────────────
function formatMass(kg: number): string {
  if (!kg || kg === 0) return '—'
  const exp = Math.floor(Math.log10(kg))
  const mant = (kg / Math.pow(10, exp)).toFixed(2)
  return `${mant}×10^${exp}`
}

function updateInfoPanel(a: Asteroid, b: Asteroid) {
  document.getElementById('info-a-name')!.textContent    = a.name
  document.getElementById('info-a-diam')!.textContent    = `${a.diameterKm.toFixed(1)} km`
  document.getElementById('info-a-mass')!.textContent    = formatMass(a.massKg)
  document.getElementById('info-a-albedo')!.textContent  = a.albedo ? a.albedo.toFixed(3) : '—'
  document.getElementById('info-a-type')!.textContent    = a.spectralClass || '—'
  document.getElementById('info-a-sma')!.textContent     = a.semiMajorAxisAU ? `${a.semiMajorAxisAU.toFixed(3)} AU` : '—'

  document.getElementById('info-b-name')!.textContent    = b.name
  document.getElementById('info-b-diam')!.textContent    = `${b.diameterKm.toFixed(1)} km`
  document.getElementById('info-b-mass')!.textContent    = formatMass(b.massKg)
  document.getElementById('info-b-albedo')!.textContent  = b.albedo ? b.albedo.toFixed(3) : '—'
  document.getElementById('info-b-type')!.textContent    = b.spectralClass || '—'
  document.getElementById('info-b-sma')!.textContent     = b.semiMajorAxisAU ? `${b.semiMajorAxisAU.toFixed(3)} AU` : '—'
}

function asteroidHTML(a: Asteroid): string {
  const spectral = a.spectralClass ? ` · ${a.spectralClass}-type` : ''
  return `${a.name}<span class="asteroid-detail">${a.diameterKm.toFixed(0)} km${spectral}</span>`
}

function updateAsteroidNames(a: Asteroid, b: Asteroid) {
  document.getElementById('asteroid-a')!.innerHTML = asteroidHTML(a)
  document.getElementById('asteroid-b')!.innerHTML = asteroidHTML(b)
  updateInfoPanel(a, b)
}
updateAsteroidNames(asteroidA, asteroidB)

// ── Particle count slider ─────────────────────────────────────────────────────
const particleCountEl = document.getElementById('particle-count') as HTMLInputElement
const particleCountValEl = document.getElementById('particle-count-val')!
particleCountEl.addEventListener('input', () => {
  particleCountValEl.textContent = particleCountEl.value
})
function getParticleTarget(): number {
  return parseInt(particleCountEl.value, 10)
}

// ── Physics sliders ───────────────────────────────────────────────────────────
function bindSlider(id: string, valId: string, setter: (v: number) => void, fmt?: (v: number) => string) {
  const el = document.getElementById(id) as HTMLInputElement
  const valEl = document.getElementById(valId)!
  el.addEventListener('input', () => {
    const v = parseFloat(el.value)
    setter(v)
    valEl.textContent = fmt ? fmt(v) : String(v)
  })
}

bindSlider('sl-gravity', 'sv-gravity', v => { physics.G_SIM = v })
bindSlider('sl-spring',  'sv-spring',  v => { physics.GOAL_K = v })
bindSlider('sl-drift',   'sv-drift',   v => { physics.DRIFT_DELAY = v }, v => v.toFixed(1))
bindSlider('sl-ramp',    'sv-ramp',    v => { physics.RAMP_DURATION = v }, v => v.toFixed(1))
bindSlider('sl-bdamp',   'sv-bdamp',   v => { physics.BURST_DAMP = v }, v => v.toFixed(3))
bindSlider('sl-fdamp',   'sv-fdamp',   v => { physics.FORM_DAMP = v }, v => v.toFixed(3))

// ── Emotion chips ─────────────────────────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>('.chip').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.emotion! as EmotionKey
    manualOverrideUntil = performance.now() + MANUAL_OVERRIDE_MS
    setActiveEmotion(key)
    const ready = collisionPhase === 'idle' ||
      (collisionPhase === 'forming' && getLockedCount() === getParticleCount() && getParticleCount() > 0)
    if (ready) triggerCollision()
  })
})
document.querySelector<HTMLButtonElement>('[data-emotion="joy"]')?.classList.add('active')

// ── Camera ────────────────────────────────────────────────────────────────────
document.getElementById('camera-btn')!.addEventListener('click', async () => {
  if (isCameraActive()) {
    stopDetectionLoop()
    stopCamera()
  } else {
    const started = await initCamera()
    if (started) {
      startDetectionLoop(getVideoElement(), (scores) => {
        updateEmotionBars(scores)
        if (performance.now() < manualOverrideUntil) return
        const dominant = pickDominantEmotion(scores)
        setActiveEmotion(dominant)
        if (dominant !== dwellEmotion) {
          dwellEmotion = dominant
          dwellStart   = performance.now()
        }
        const ready = collisionPhase === 'idle' ||
          (collisionPhase === 'forming' && getLockedCount() === getParticleCount() && getParticleCount() > 0)
        if (ready && performance.now() - dwellStart > DWELL_MS) {
          triggerCollision()
          dwellStart = performance.now()
        }
      })
    }
  }
})

// ── Collision trigger ─────────────────────────────────────────────────────────
function triggerCollision() {
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  debugTargets      = rasterizeEmoji(EMOTION_EMOJI[currentEmotion], cx, cy)
  debugTargetsSetAt = performance.now()
  clearParticles()
  collisionPhase = 'approaching'
  phaseStart     = performance.now()
}

function setActiveEmotion(key: EmotionKey) {
  if (currentEmotion === key) return
  currentEmotion = key
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'))
  document.querySelector<HTMLButtonElement>(`[data-emotion="${key}"]`)?.classList.add('active')
}

document.getElementById('trigger-btn')!.addEventListener('click', triggerCollision)

// ── Background picker ─────────────────────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>('.bg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setBackground(btn.dataset.bg as BackgroundKey)
    document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  })
})

// ── Debug dots (fading) ───────────────────────────────────────────────────────
const DEBUG_FADE_START = 3.0   // seconds before dots start fading
const DEBUG_FADE_TOTAL = 5.0   // seconds until fully gone

function drawDebugDots(now: number) {
  if (debugTargets.length === 0) return
  const age = (now - debugTargetsSetAt) / 1000
  if (age >= DEBUG_FADE_TOTAL) { debugTargets = []; return }
  const alpha = age < DEBUG_FADE_START
    ? 0.7
    : 0.7 * (1 - (age - DEBUG_FADE_START) / (DEBUG_FADE_TOTAL - DEBUG_FADE_START))
  for (const t of debugTargets) {
    ctx.beginPath()
    ctx.arc(t.x, t.y, 2, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(124, 200, 255, ${alpha})`
    ctx.fill()
  }
}

// ── Emotion bars ──────────────────────────────────────────────────────────────
function updateEmotionBars(raw: FaceApiScores) {
  const scores = extractScores(raw)
  for (const key of Object.keys(scores) as EmotionKey[]) {
    const pct = Math.round(scores[key] * 100)
    document.getElementById(`bar-${key}`)!.style.width = `${pct}%`
    document.getElementById(`val-${key}`)!.textContent  = `${pct}%`
  }
}

// ── Visual effects state ──────────────────────────────────────────────────────
let shakeMag   = 0
let flashAlpha = 0
let shockwave: { x: number; y: number; age: number } | null = null
const SHOCKWAVE_DURATION = 0.5

let lastTime = performance.now()

function loop(now: number) {
  const dt      = (now - lastTime) / 1000
  lastTime      = now
  const elapsed = (now - phaseStart) / 1000

  drawBackground()

  if (flashAlpha > 0.01) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    flashAlpha *= 0.78
  } else {
    flashAlpha = 0
  }

  if (shakeMag > 0.5) {
    const sx = (Math.random() - 0.5) * shakeMag
    const sy = (Math.random() - 0.5) * shakeMag
    canvas.style.transform = `translate(${sx}px, ${sy}px)`
    shakeMag *= 0.82
  } else {
    canvas.style.transform = ''
    shakeMag = 0
  }

  const restAX = canvas.width * 0.28
  const restBX = canvas.width * 0.72
  const midY   = canvas.height * 0.5
  const cx     = canvas.width  / 2

  const sep = (collisionPhase === 'impact' || collisionPhase === 'forming')
    ? EMOTION_EMOJI[currentEmotion]
    : '⚡'
  document.getElementById('asteroid-sep')!.textContent = sep

  if (collisionPhase === 'idle') {
    drawAsteroid(asteroidA, restAX, midY)
    drawAsteroid(asteroidB, restBX, midY)
    document.getElementById('stat-phase')!.textContent = 'idle'

  } else if (collisionPhase === 'approaching') {
    const t     = Math.min(1, elapsed / APPROACH_DURATION)
    const eased = t * t
    drawAsteroid(asteroidA, restAX + (cx - restAX) * eased, midY)
    drawAsteroid(asteroidB, restBX + (cx - restBX) * eased, midY)
    document.getElementById('stat-phase')!.textContent = 'approaching'

    if (t >= 1) {
      spawnParticles(cx, midY, getParticleTarget(), 150, EMOTION_COLORS[currentEmotion])
      assignTargets(getParticles(), debugTargets)
      spawnFragments(cx, midY, 120, 380)
      shakeMag   = 18
      flashAlpha = 0.45
      shockwave  = { x: cx, y: midY, age: 0 }
      collisionPhase = 'impact'
      phaseStart     = now
    }

  } else if (collisionPhase === 'impact') {
    drawAsteroid(asteroidA, cx, midY)
    drawAsteroid(asteroidB, cx, midY)
    document.getElementById('stat-phase')!.textContent = 'impact'

    if (elapsed >= IMPACT_DURATION) {
      collisionPhase = 'forming'
      formingStart   = now
      ;[asteroidA, asteroidB] = pickCollisionPair()
      updateAsteroidNames(asteroidA, asteroidB)
      syncSelectsToAsteroids()
    }

  } else {
    const fe = (now - formingStart) / 1000
    const subPhase = fe < physics.DRIFT_DELAY                          ? 'burst'
                   : fe < physics.DRIFT_DELAY + physics.RAMP_DURATION  ? 'drift'
                   : 'forming'
    document.getElementById('stat-phase')!.textContent = subPhase
  }

  updateParticles(dt)
  drawParticles()

  if (shockwave) {
    shockwave.age += dt
    const t = Math.min(1, shockwave.age / SHOCKWAVE_DURATION)
    if (t >= 1) {
      shockwave = null
    } else {
      const maxR = Math.max(canvas.width, canvas.height) * 0.9
      const r     = maxR * t
      const alpha = (1 - t) * (1 - t)
      const inner = r * 0.72
      const grd   = ctx.createRadialGradient(shockwave.x, shockwave.y, inner, shockwave.x, shockwave.y, r)
      grd.addColorStop(0,   'rgba(255,255,255,0)')
      grd.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.9})`)
      grd.addColorStop(1,   'rgba(255,255,255,0)')
      ctx.beginPath()
      ctx.arc(shockwave.x, shockwave.y, r, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()
    }
  }

  drawDebugDots(now)

  const total  = getParticleCount()
  const locked = getLockedCount()
  document.getElementById('stat-particles')!.textContent = `${total}`
  document.getElementById('stat-formed')!.textContent =
    total > 0 ? `${Math.round(locked / total * 100)}%` : '0%'

  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
