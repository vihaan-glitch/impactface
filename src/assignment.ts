import { hungarian } from './hungarian'
import type { Particle } from './simulation'
import type { PixelTarget } from './emojiRasterizer'

// Assign each particle to a unique target via Hungarian algorithm (min total distance).
// Updates targetX/Y on each particle in-place.
export function assignTargets(particles: Particle[], targets: PixelTarget[]): void {
  const n = particles.length
  if (n === 0 || targets.length === 0) return

  const chosen = subsample(targets, n)
  const k = Math.min(n, chosen.length)

  // k×k cost matrix of squared Euclidean distances
  const cost: number[][] = []
  for (let i = 0; i < k; i++) {
    const { x, y } = particles[i]
    cost[i] = chosen.map(t => (x - t.x) ** 2 + (y - t.y) ** 2)
  }

  const asgn = hungarian(cost)
  for (let i = 0; i < k; i++) {
    const t = chosen[asgn[i]]
    particles[i].targetX = t.x
    particles[i].targetY = t.y
    particles[i].goalAge  = 0
  }
  // Clear assignment for any excess particles beyond available targets
  for (let i = k; i < n; i++) {
    particles[i].targetX = null
    particles[i].targetY = null
  }
}

// Evenly-spaced subsample so all parts of the face shape are represented
function subsample(targets: PixelTarget[], n: number): PixelTarget[] {
  if (targets.length <= n) return [...targets]
  const step = targets.length / n
  return Array.from({ length: n }, (_, i) => targets[Math.floor(i * step)])
}
