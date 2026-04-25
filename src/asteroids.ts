export interface Asteroid {
  id: string
  name: string
  diameterKm: number
  massKg: number
  albedo: number
  spectralClass: string
  semiMajorAxisAU: number
}

let _asteroids: Asteroid[] = []

export async function loadAsteroids(): Promise<void> {
  const res = await fetch('/asteroids.json')
  _asteroids = await res.json()
}

// Returns two distinct large asteroids for the collision
export function pickCollisionPair(): [Asteroid, Asteroid] {
  // Sort by diameter descending, pick from the top 50 so we always get big named ones
  const large = [..._asteroids].sort((a, b) => b.diameterKm - a.diameterKm).slice(0, 50)
  const i = Math.floor(Math.random() * large.length)
  let j = Math.floor(Math.random() * large.length)
  while (j === i) j = Math.floor(Math.random() * large.length)
  return [large[i], large[j]]
}

export function getAll(): Asteroid[] {
  return _asteroids
}

export function getAllSorted(): Asteroid[] {
  return [..._asteroids].sort((a, b) => b.diameterKm - a.diameterKm)
}

export function getById(id: string): Asteroid | undefined {
  return _asteroids.find(a => a.id === id)
}
