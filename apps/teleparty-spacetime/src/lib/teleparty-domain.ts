import { z } from 'zod'

export const DEFAULT_AUTO_SOUNDBOARD_CAPACITY = 8
export const MIN_SOUNDBOARD_CAPACITY = 2
export const MAX_SOUNDBOARD_CAPACITY = 64

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)

export const accessCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(16)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .transform((value) => value.toLowerCase())

export const visibilitySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('public') }),
  z.object({ kind: z.literal('private'), accessCode: accessCodeSchema }),
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

export const watchUrlSchema = z
  .string()
  .trim()
  .url()
  .transform((value) => {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http/https links are supported.')
    }
    return parsed.toString()
  })

export const createRoomInputSchema = z.object({
  watchUrl: watchUrlSchema,
  visibility: visibilitySchema,
  soundboardPolicy: soundboardPolicySchema,
})

export const roomJoinInputSchema = z.object({
  roomCode: roomCodeSchema,
  accessCode: z.string().optional(),
})

export type Visibility = z.infer<typeof visibilitySchema>
export type SoundboardPolicy = z.infer<typeof soundboardPolicySchema>

export function normalizeAccessCode(value?: string): string {
  if (!value) {
    return ''
  }
  return value.trim().toLowerCase()
}

export function normalizeRoomCode(value: string): string {
  return roomCodeSchema.parse(value)
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
