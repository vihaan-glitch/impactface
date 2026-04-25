// Emotion mapping layer between face-api.js labels and our internal keys.
// face-api returns 7 expressions; we collapse them to 5 renderable emotions
// and ignore neutral / disgusted (neither maps cleanly to an emoji face).

export type EmotionKey = 'joy' | 'anger' | 'fear' | 'sadness' | 'surprise'

// Shape of the FaceExpressions object returned by face-api.js (all values 0–1, sum ≈ 1)
export interface FaceApiScores {
  neutral:   number
  happy:     number
  sad:       number
  angry:     number
  fearful:   number
  disgusted: number
  surprised: number
}

export const EMOTION_COLORS: Record<EmotionKey, string> = {
  joy:      'rgb(255, 220, 50)',
  anger:    'rgb(255, 55,  55)',
  fear:     'rgb(155, 75,  255)',
  sadness:  'rgb(70,  155, 255)',
  surprise: 'rgb(255, 135, 35)',
}

// face-api label → our EmotionKey (neutral and disgusted are intentionally omitted)
const LABEL_MAP: Array<[keyof FaceApiScores, EmotionKey]> = [
  ['happy',     'joy'],
  ['angry',     'anger'],
  ['fearful',   'fear'],
  ['sad',       'sadness'],
  ['surprised', 'surprise'],
]

// Pull our five scores out of a raw face-api result
export function extractScores(raw: Partial<FaceApiScores>): Record<EmotionKey, number> {
  return {
    joy:      raw.happy     ?? 0,
    anger:    raw.angry     ?? 0,
    fear:     raw.fearful   ?? 0,
    sadness:  raw.sad       ?? 0,
    surprise: raw.surprised ?? 0,
  }
}

// Return whichever of our five emotions has the highest score.
// Neutral / disgusted frames fall through to whatever mapped emotion is strongest.
export function pickDominantEmotion(raw: Partial<FaceApiScores>): EmotionKey {
  let best: EmotionKey = 'joy'
  let bestScore = -1
  for (const [label, key] of LABEL_MAP) {
    const score = raw[label] ?? 0
    if (score > bestScore) {
      bestScore = score
      best = key
    }
  }
  return best
}
