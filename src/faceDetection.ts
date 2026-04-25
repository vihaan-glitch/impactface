import * as faceapi from 'face-api.js'
import type { FaceApiScores } from './emotions'

const MODEL_URL = '/models'

let modelsLoaded = false
let loopRunning  = false

// Load both models in parallel. Safe to call multiple times.
export async function loadModels(): Promise<void> {
  if (modelsLoaded) return
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
  ])
  modelsLoaded = true
}

export function areModelsLoaded(): boolean {
  return modelsLoaded
}

// Run face + expression detection on a repeating interval (not every rAF frame —
// detection is expensive and 300 ms is fast enough to feel responsive).
export function startDetectionLoop(
  video: HTMLVideoElement,
  onScores: (scores: FaceApiScores) => void,
  intervalMs = 300,
): void {
  if (loopRunning) return
  loopRunning = true

  const tick = async () => {
    if (!loopRunning) return

    // Only detect when the video has actual frame data
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        const result = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
          .withFaceExpressions()

        if (result?.expressions) {
          onScores(result.expressions as unknown as FaceApiScores)
        }
      } catch {
        // Detection can fail on individual frames — just skip
      }
    }

    if (loopRunning) setTimeout(tick, intervalMs)
  }

  tick()
}

export function stopDetectionLoop(): void {
  loopRunning = false
}
