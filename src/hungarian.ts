// O(n³) minimum-cost assignment (Jonker-Volgenant style).
// cost[i][j] = cost of assigning row i to column j.
// Returns assignment where result[i] = j.
export function hungarian(cost: number[][]): number[] {
  const n = cost.length
  if (n === 0) return []

  const u    = new Array<number>(n + 1).fill(0)
  const v    = new Array<number>(n + 1).fill(0)
  const p    = new Array<number>(n + 1).fill(0)  // p[j] = row assigned to col j
  const way  = new Array<number>(n + 1).fill(0)

  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minD = new Array<number>(n + 1).fill(Infinity)
    const used = new Array<boolean>(n + 1).fill(false)

    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = Infinity
      let j1    = -1

      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          const r = cost[i0 - 1][j - 1] - u[i0] - v[j]
          if (r < minD[j]) { minD[j] = r; way[j] = j0 }
          if (minD[j] < delta) { delta = minD[j]; j1 = j }
        }
      }

      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta }
        else minD[j] -= delta
      }
      j0 = j1!
    } while (p[j0] !== 0)

    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0 !== 0)
  }

  const result = new Array<number>(n).fill(0)
  for (let j = 1; j <= n; j++) if (p[j] !== 0) result[p[j] - 1] = j - 1
  return result
}
