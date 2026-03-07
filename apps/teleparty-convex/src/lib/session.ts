import { customAlphabet } from 'nanoid'
import { z } from 'zod'

const sessionProfileBaseSchema = z.object({
  sessionId: z.string().min(8).max(64),
  displayName: z.string().min(2).max(24),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
})

const sessionSecretSchema = z.string().min(24).max(64).regex(/^[a-z0-9]+$/)

const sessionSchema = sessionProfileBaseSchema.extend({
  sessionSecret: sessionSecretSchema,
})

export type SessionProfile = z.infer<typeof sessionSchema>

export const SESSION_PROFILE_PLACEHOLDER: SessionProfile = {
  sessionId: 'pending-session-id',
  sessionSecret: 'pendingownersessionsecret00000000',
  displayName: 'Loading User',
  color: '#f97316',
}

const storageKey = 'tp-convex-session-v1'
const makeId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 20)
const makeSecret = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 32)

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
    sessionSecret: makeSecret(),
    displayName: `${randomItem(adjectives)} ${randomItem(nouns)}`,
    color: randomItem(palette),
  }
}

function upgradeProfile(
  profile: z.infer<typeof sessionProfileBaseSchema>,
): SessionProfile {
  return {
    ...profile,
    sessionSecret: makeSecret(),
  }
}

function parseStoredProfile(raw: string): SessionProfile | null {
  try {
    const parsedJson = JSON.parse(raw)

    const parsed = sessionSchema.safeParse(parsedJson)
    if (parsed.success) {
      return parsed.data
    }

    const legacy = sessionProfileBaseSchema.safeParse(parsedJson)
    return legacy.success ? upgradeProfile(legacy.data) : null
  } catch {
    return null
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

  const parsed = parseStoredProfile(raw)
  if (!parsed) {
    const profile = createDefaultProfile()
    window.localStorage.setItem(storageKey, JSON.stringify(profile))
    return profile
  }

  window.localStorage.setItem(storageKey, JSON.stringify(parsed))
  return parsed
}

export function saveSessionProfile(profile: SessionProfile): SessionProfile {
  const parsed = sessionSchema.parse(profile)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, JSON.stringify(parsed))
  }

  return parsed
}
