import { MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { customAlphabet } from 'nanoid'
import { ConvexError, v } from 'convex/values'
import {
  DEFAULT_AUTO_SOUNDBOARD_CAPACITY,
  ROOM_CODE_LENGTH,
  canUseSoundboard,
  createRoomSchema,
  cursorUpdateSchema,
  normalizeAccessCode,
  roomCodeSchema,
  roomLookupSchema,
  sessionIdSchema,
  soundboardPolicySchema,
  triggerSoundSchema,
} from './domain'
import { components, internal } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'
import { roomPresence } from './presence'
import { ROOM_IDLE_TTL_MS, roomWorkflows } from './workflows'

const roomCodeGenerator = customAlphabet(
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  ROOM_CODE_LENGTH,
)

const MAX_PUBLIC_ROOMS = 24
const MAX_CURSOR_ROWS = 300
const MAX_SOUND_EVENTS = 120
const CURSOR_STALE_MS = 15_000

const visibilityValidator = v.union(
  v.object({
    kind: v.literal('public'),
  }),
  v.object({
    kind: v.literal('private'),
    accessCode: v.string(),
  }),
)

const soundboardPolicyValidator = v.union(
  v.object({
    kind: v.literal('auto'),
    defaultMaxParticipants: v.number(),
  }),
  v.object({
    kind: v.literal('manual'),
    enabled: v.boolean(),
    maxParticipants: v.number(),
  }),
)

const roomRateLimiter = new RateLimiter(components.rateLimiter, {
  cursorBurst: {
    kind: 'token bucket',
    rate: 240,
    period: MINUTE,
    capacity: 45,
  },
  soundboardBurst: {
    kind: 'token bucket',
    rate: 36,
    period: MINUTE,
    capacity: 6,
  },
})

async function findRoomByCode(ctx: any, roomCode: string) {
  return ctx.db
    .query('rooms')
    .withIndex('by_room_code', (q: any) => q.eq('roomCode', roomCode))
    .first()
}

async function createUniqueRoomCode(ctx: any): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = roomCodeGenerator()
    const existing = await findRoomByCode(ctx, candidate)
    if (!existing) {
      return candidate
    }
  }

  throw new ConvexError({
    code: 'room_code_generation_failed',
    message: 'Unable to allocate room code. Please retry.',
  })
}

async function trimCursorRows(ctx: any, roomCode: string): Promise<void> {
  const rows = await ctx.db
    .query('cursorStates')
    .withIndex('by_room_updated', (q: any) => q.eq('roomCode', roomCode))
    .order('desc')
    .take(MAX_CURSOR_ROWS + 100)

  if (rows.length <= MAX_CURSOR_ROWS) {
    return
  }

  await Promise.all(
    rows.slice(MAX_CURSOR_ROWS).map((row: any) => ctx.db.delete(row._id)),
  )
}

async function trimSoundEvents(ctx: any, roomCode: string): Promise<void> {
  const rows = await ctx.db
    .query('soundboardEvents')
    .withIndex('by_room_created', (q: any) => q.eq('roomCode', roomCode))
    .order('desc')
    .take(MAX_SOUND_EVENTS + 80)

  if (rows.length <= MAX_SOUND_EVENTS) {
    return
  }

  await Promise.all(
    rows.slice(MAX_SOUND_EVENTS).map((row: any) => ctx.db.delete(row._id)),
  )
}

export const createRoom = mutation({
  args: {
    watchUrl: v.string(),
    ownerSessionId: v.string(),
    ownerDisplayName: v.string(),
    visibility: visibilityValidator,
    soundboardPolicy: soundboardPolicyValidator,
  },
  handler: async (ctx, args) => {
    const parsed = createRoomSchema.parse({
      watchUrl: args.watchUrl,
      ownerSessionId: args.ownerSessionId,
      ownerDisplayName: args.ownerDisplayName,
      visibility: args.visibility,
      soundboardPolicy: args.soundboardPolicy,
    })

    const roomCode = await createUniqueRoomCode(ctx)
    const now = Date.now()

    const watchHost = new URL(parsed.watchUrl).host

    await ctx.db.insert('rooms', {
      roomCode,
      watchUrl: parsed.watchUrl,
      watchHost,
      createdAt: now,
      lastActivityAt: now,
      createdBySessionId: parsed.ownerSessionId,
      createdByDisplayName: parsed.ownerDisplayName,
      visibility: parsed.visibility,
      soundboardPolicy: parsed.soundboardPolicy,
      archived: false,
    })

    await roomWorkflows.start(ctx, internal.workflows.expireRoomAfterIdle, {
      roomCode,
    })

    return {
      roomCode,
    }
  },
})

export const listPublicRooms = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 10, MAX_PUBLIC_ROOMS))

    const rooms = await ctx.db
      .query('rooms')
      .withIndex('by_visibility_created', (q) => q.eq('visibility.kind', 'public'))
      .order('desc')
      .take(limit * 2)

    const activeRooms = rooms.filter((room) => !room.archived).slice(0, limit)

    const withPresence = await Promise.all(
      activeRooms.map(async (room) => {
        const participants = await roomPresence.list(ctx, room.roomCode)

        return {
          roomCode: room.roomCode,
          watchUrl: room.watchUrl,
          watchHost: room.watchHost,
          createdAt: room.createdAt,
          createdByDisplayName: room.createdByDisplayName,
          participantCount: participants.filter((p) => p.online).length,
          soundboardPolicy: room.soundboardPolicy,
        }
      }),
    )

    return withPresence
  },
})

export const getRoom = query({
  args: {
    roomCode: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parsed = roomLookupSchema.parse(args)

    const room = await findRoomByCode(ctx, parsed.roomCode)
    if (!room || room.archived) {
      return {
        kind: 'not_found' as const,
      }
    }

    if (
      room.visibility.kind === 'private' &&
      room.visibility.accessCode !== normalizeAccessCode(parsed.accessCode)
    ) {
      return {
        kind: 'forbidden' as const,
      }
    }

    const participants = await roomPresence.list(ctx, parsed.roomCode)

    return {
      kind: 'ok' as const,
      room: {
        roomCode: room.roomCode,
        watchUrl: room.watchUrl,
        watchHost: room.watchHost,
        createdAt: room.createdAt,
        createdByDisplayName: room.createdByDisplayName,
        createdBySessionId: room.createdBySessionId,
        visibility: room.visibility,
        soundboardPolicy: room.soundboardPolicy,
        participantCount: participants.filter((participant) => participant.online)
          .length,
      },
    }
  },
})

export const updateSoundboardPolicy = mutation({
  args: {
    roomCode: v.string(),
    ownerSessionId: v.string(),
    soundboardPolicy: soundboardPolicyValidator,
  },
  handler: async (ctx, args) => {
    const roomCode = roomCodeSchema.parse(args.roomCode)
    const ownerSessionId = sessionIdSchema.parse(args.ownerSessionId)
    const soundboardPolicy = soundboardPolicySchema.parse(args.soundboardPolicy)

    const room = await findRoomByCode(ctx, roomCode)

    if (!room || room.archived) {
      throw new ConvexError({
        code: 'room_not_found',
        message: 'Room was not found.',
      })
    }

    if (room.createdBySessionId !== ownerSessionId) {
      throw new ConvexError({
        code: 'not_owner',
        message: 'Only the room owner can update room settings.',
      })
    }

    await ctx.db.patch(room._id, {
      soundboardPolicy,
      lastActivityAt: Date.now(),
    })

    return {
      ok: true,
    }
  },
})

export const upsertCursor = mutation({
  args: {
    roomCode: v.string(),
    sessionId: v.string(),
    displayName: v.string(),
    color: v.string(),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const parsed = cursorUpdateSchema.parse(args)

    const room = await findRoomByCode(ctx, parsed.roomCode)
    if (!room || room.archived) {
      throw new ConvexError({
        code: 'room_not_found',
        message: 'Cannot update cursor for an archived room.',
      })
    }

    const limitStatus = await roomRateLimiter.limit(ctx, 'cursorBurst', {
      key: `${parsed.roomCode}:${parsed.sessionId}`,
    })

    if (!limitStatus.ok) {
      return {
        ok: false,
      }
    }

    const existing = await ctx.db
      .query('cursorStates')
      .withIndex('by_room_session', (q) =>
        q.eq('roomCode', parsed.roomCode).eq('sessionId', parsed.sessionId),
      )
      .first()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: parsed.displayName,
        color: parsed.color,
        x: parsed.x,
        y: parsed.y,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('cursorStates', {
        roomCode: parsed.roomCode,
        sessionId: parsed.sessionId,
        displayName: parsed.displayName,
        color: parsed.color,
        x: parsed.x,
        y: parsed.y,
        updatedAt: now,
      })
    }

    await ctx.db.patch(room._id, {
      lastActivityAt: now,
    })

    await trimCursorRows(ctx, parsed.roomCode)

    return {
      ok: true,
    }
  },
})

export const listCursors = query({
  args: {
    roomCode: v.string(),
  },
  handler: async (ctx, args) => {
    const roomCode = roomCodeSchema.parse(args.roomCode)

    const threshold = Date.now() - CURSOR_STALE_MS

    return ctx.db
      .query('cursorStates')
      .withIndex('by_room_updated', (q) =>
        q.eq('roomCode', roomCode).gte('updatedAt', threshold),
      )
      .collect()
  },
})

export const triggerSound = mutation({
  args: {
    roomCode: v.string(),
    sessionId: v.string(),
    displayName: v.string(),
    soundId: v.string(),
  },
  handler: async (ctx, args) => {
    const parsed = triggerSoundSchema.parse(args)

    const room = await findRoomByCode(ctx, parsed.roomCode)
    if (!room || room.archived) {
      throw new ConvexError({
        code: 'room_not_found',
        message: 'Room not found.',
      })
    }

    const limitStatus = await roomRateLimiter.limit(ctx, 'soundboardBurst', {
      key: `${parsed.roomCode}:${parsed.sessionId}`,
    })

    if (!limitStatus.ok) {
      throw new ConvexError({
        code: 'rate_limited',
        message: 'Soundboard burst limit reached. Slow down a bit.',
      })
    }

    const onlineParticipants = (await roomPresence.list(ctx, parsed.roomCode)).filter(
      (participant) => participant.online,
    )

    if (!canUseSoundboard(room.soundboardPolicy, onlineParticipants.length)) {
      throw new ConvexError({
        code: 'soundboard_disabled',
        message:
          'Soundboard is currently disabled for this room size. The room owner can adjust it.',
      })
    }

    const createdAt = Date.now()
    const eventId = `${createdAt}-${parsed.sessionId}-${parsed.soundId}`

    await ctx.db.insert('soundboardEvents', {
      eventId,
      roomCode: parsed.roomCode,
      soundId: parsed.soundId,
      actorSessionId: parsed.sessionId,
      actorDisplayName: parsed.displayName,
      createdAt,
    })

    await ctx.db.patch(room._id, {
      lastActivityAt: createdAt,
    })

    await trimSoundEvents(ctx, parsed.roomCode)

    return {
      eventId,
      createdAt,
    }
  },
})

export const listSoundEvents = query({
  args: {
    roomCode: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const roomCode = roomCodeSchema.parse(args.roomCode)
    const limit = Math.max(1, Math.min(args.limit ?? 40, MAX_SOUND_EVENTS))

    const rows = await ctx.db
      .query('soundboardEvents')
      .withIndex('by_room_created', (q) => q.eq('roomCode', roomCode))
      .order('desc')
      .take(limit)

    return rows.reverse()
  },
})

export const archiveRoomIfIdle = internalMutation({
  args: {
    roomCode: v.string(),
  },
  handler: async (ctx, args) => {
    const roomCode = roomCodeSchema.parse(args.roomCode)
    const room = await findRoomByCode(ctx, roomCode)

    if (!room || room.archived) {
      return { archived: false }
    }

    const isIdle = room.lastActivityAt < Date.now() - ROOM_IDLE_TTL_MS
    if (!isIdle) {
      return { archived: false }
    }

    await ctx.db.patch(room._id, {
      archived: true,
      archivedAt: Date.now(),
    })

    const cursors = await ctx.db
      .query('cursorStates')
      .withIndex('by_room_updated', (q) => q.eq('roomCode', roomCode))
      .collect()

    const sounds = await ctx.db
      .query('soundboardEvents')
      .withIndex('by_room_created', (q) => q.eq('roomCode', roomCode))
      .collect()

    await Promise.all([
      ...cursors.map((cursor) => ctx.db.delete(cursor._id)),
      ...sounds.map((sound) => ctx.db.delete(sound._id)),
    ])

    return { archived: true }
  },
})

export const defaultRoomPolicy = query({
  args: {},
  handler: async () => {
    return {
      soundboardPolicy: {
        kind: 'auto' as const,
        defaultMaxParticipants: DEFAULT_AUTO_SOUNDBOARD_CAPACITY,
      },
    }
  },
})
