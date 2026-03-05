import { z } from 'zod'

export const ROOM_CODE_LENGTH = 6
export const DEFAULT_AUTO_SOUNDBOARD_CAPACITY = 8
export const MIN_SOUNDBOARD_CAPACITY = 2
export const MAX_SOUNDBOARD_CAPACITY = 64

const roomCodeRegex = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/

export const soundIdSchema = z.enum([
  'airhorn',
  'rimshot',
  'cheer',
  'boo',
  'ta-da',
  'whoosh',
])

export type SoundId = z.infer<typeof soundIdSchema>

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(roomCodeRegex)

export const watchUrlSchema = z
  .string()
  .trim()
  .url()
  .transform((value) => {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Watch links must use http or https.')
    }
    return parsed.toString()
  })

export const sessionIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/)

export const displayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .transform((value) => value.replace(/\s+/g, ' '))

export const colorSchema = z
  .string()
  .trim()
  .regex(/^#[a-fA-F0-9]{6}$/)
  .transform((value) => value.toLowerCase())

export const accessCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(16)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .transform((value) => value.toLowerCase())

export const roomVisibilitySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('public'),
  }),
  z.object({
    kind: z.literal('private'),
    accessCode: accessCodeSchema,
  }),
])

export const soundboardPolicySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('auto'),
    defaultMaxParticipants: z
      .number()
      .int()
      .min(MIN_SOUNDBOARD_CAPACITY)
      .max(MAX_SOUNDBOARD_CAPACITY),
  }),
  z.object({
    kind: z.literal('manual'),
    enabled: z.boolean(),
    maxParticipants: z
      .number()
      .int()
      .min(MIN_SOUNDBOARD_CAPACITY)
      .max(MAX_SOUNDBOARD_CAPACITY),
  }),
])

export const createRoomSchema = z.object({
  watchUrl: watchUrlSchema,
  ownerSessionId: sessionIdSchema,
  ownerDisplayName: displayNameSchema,
  visibility: roomVisibilitySchema,
  soundboardPolicy: soundboardPolicySchema,
})

export const roomLookupSchema = z.object({
  roomCode: roomCodeSchema,
  accessCode: z.string().optional(),
})

export const cursorUpdateSchema = z.object({
  roomCode: roomCodeSchema,
  sessionId: sessionIdSchema,
  displayName: displayNameSchema,
  color: colorSchema,
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
})

export const triggerSoundSchema = z.object({
  roomCode: roomCodeSchema,
  sessionId: sessionIdSchema,
  displayName: displayNameSchema,
  soundId: soundIdSchema,
})

export type RoomVisibility = z.infer<typeof roomVisibilitySchema>
export type SoundboardPolicy = z.infer<typeof soundboardPolicySchema>

export function normalizeAccessCode(value: string | undefined): string {
  if (!value) {
    return ''
  }
  return value.trim().toLowerCase()
}

export function canUseSoundboard(
  policy: SoundboardPolicy,
  participantCount: number,
): boolean {
  if (policy.kind === 'auto') {
    return participantCount <= policy.defaultMaxParticipants
  }
  return policy.enabled && participantCount <= policy.maxParticipants
}
