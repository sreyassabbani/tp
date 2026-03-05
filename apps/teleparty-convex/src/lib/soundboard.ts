import type { SoundId } from '#/lib/teleparty-domain'

export const sounds: Array<{ id: SoundId; label: string }> = [
  { id: 'airhorn', label: 'Airhorn' },
  { id: 'rimshot', label: 'Rimshot' },
  { id: 'cheer', label: 'Cheer' },
  { id: 'boo', label: 'Boo' },
  { id: 'ta-da', label: 'Ta-da' },
  { id: 'whoosh', label: 'Whoosh' },
]

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

function blip(
  context: AudioContext,
  options: {
    frequency: number
    duration: number
    type?: OscillatorType
    gain?: number
    delay?: number
  },
): void {
  const osc = context.createOscillator()
  const gain = context.createGain()

  osc.type = options.type ?? 'triangle'
  osc.frequency.value = options.frequency

  const startAt = context.currentTime + (options.delay ?? 0)
  const endAt = startAt + options.duration

  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(options.gain ?? 0.2, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt)

  osc.connect(gain)
  gain.connect(context.destination)
  osc.start(startAt)
  osc.stop(endAt)
}

export function playSound(id: SoundId): void {
  if (typeof window === 'undefined') {
    return
  }

  const context = getAudioContext()

  switch (id) {
    case 'airhorn':
      blip(context, { frequency: 440, duration: 0.32, type: 'sawtooth', gain: 0.3 })
      blip(context, {
        frequency: 660,
        duration: 0.28,
        type: 'sawtooth',
        gain: 0.25,
        delay: 0.02,
      })
      break
    case 'rimshot':
      blip(context, { frequency: 190, duration: 0.08, type: 'square', gain: 0.25 })
      blip(context, { frequency: 490, duration: 0.1, type: 'triangle', gain: 0.18, delay: 0.09 })
      break
    case 'cheer':
      blip(context, { frequency: 520, duration: 0.12, gain: 0.15 })
      blip(context, { frequency: 680, duration: 0.12, gain: 0.15, delay: 0.1 })
      blip(context, { frequency: 860, duration: 0.16, gain: 0.18, delay: 0.18 })
      break
    case 'boo':
      blip(context, { frequency: 160, duration: 0.36, type: 'sine', gain: 0.18 })
      break
    case 'ta-da':
      blip(context, { frequency: 520, duration: 0.14, gain: 0.16 })
      blip(context, { frequency: 780, duration: 0.2, gain: 0.2, delay: 0.16 })
      break
    case 'whoosh':
      blip(context, { frequency: 240, duration: 0.2, type: 'sawtooth', gain: 0.16 })
      blip(context, {
        frequency: 1220,
        duration: 0.24,
        type: 'triangle',
        gain: 0.14,
        delay: 0.12,
      })
      break
  }
}
