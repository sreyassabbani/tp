import { customAlphabet } from 'nanoid'
import { z } from 'zod'

const sessionSchema = z.object({
  sessionId: z.string().min(8).max(64),
  displayName: z.string().min(2).max(24),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
})

export type SessionProfile = z.infer<typeof sessionSchema>

const storageKey = 'tp-convex-session-v1'
const makeId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 20)

const adjectives = [
  'Keen',
  'Swift',
  'Fuzzy',
  'Mellow',
  'Sneaky',
  'Lucky',
  'Cosmic',
  'Brisk',
]

const nouns = ['Otter', 'Comet', 'Fox', 'Sparrow', 'Panda', 'Lynx', 'Tiger']

const palette = ['#f97316', '#0ea5e9', '#22c55e', '#ef4444', '#f59e0b', '#14b8a6']

function randomItem<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)]
}

function createDefaultProfile(): SessionProfile {
  return {
    sessionId: makeId(),
    displayName: `${randomItem(adjectives)} ${randomItem(nouns)}`,
    color: randomItem(palette),
  }
}

export function loadSessionProfile(): SessionProfile {
  if (typeof window === 'undefined') {
    return createDefaultProfile()
  }

  const raw = window.localStorage.getItem(storageKey)
  if (!raw) {
    const profile = createDefaultProfile()
    window.localStorage.setItem(storageKey, JSON.stringify(profile))
    return profile
  }

  const parsed = sessionSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) {
    const profile = createDefaultProfile()
    window.localStorage.setItem(storageKey, JSON.stringify(profile))
    return profile
  }

  return parsed.data
}

export function saveSessionProfile(profile: SessionProfile): SessionProfile {
  const parsed = sessionSchema.parse(profile)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, JSON.stringify(parsed))
  }

  return parsed
}
