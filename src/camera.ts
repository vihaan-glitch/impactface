const video  = document.getElementById('camera-feed')   as HTMLVideoElement
const status = document.getElementById('camera-status')  as HTMLSpanElement
const btn    = document.getElementById('camera-btn')     as HTMLButtonElement

let active = false

export async function initCamera(): Promise<boolean> {
  status.textContent = 'requesting...'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
      audio: false,
    })
    video.srcObject = stream
    video.style.display = 'block'
    status.style.display = 'none'
    btn.textContent = 'disable camera'
    active = true
    return true
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    status.textContent = name === 'NotAllowedError' ? 'permission denied' : 'unavailable'
    return false
  }
}

export function stopCamera(): void {
  const stream = video.srcObject as MediaStream | null
  stream?.getTracks().forEach(t => t.stop())
  video.srcObject      = null
  video.style.display  = 'none'
  status.style.display = ''
  status.textContent   = 'camera inactive'
  btn.textContent      = 'enable camera'
  active = false
}

export function isCameraActive(): boolean {
  return active
}

// Returned to face-api.js in Phase 18 for per-frame detection
export function getVideoElement(): HTMLVideoElement {
  return video
}
