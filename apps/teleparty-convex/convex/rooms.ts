import { MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { customAlphabet } from 'nanoid'
import { ConvexError, v } from 'convex/values'
import {
  DEFAULT_AUTO_SOUNDBOARD_CAPACITY,
  ROOM_CODE_LENGTH,
  colorSchema,
  displayNameSchema,
  type RoomCapability,
  type StageInteractionPolicy,
  canUseSoundboard,
  createRoomSchema,
  cursorUpdateSchema,
  normalizeAccessCode,
  ownerSessionSecretSchema,
  roomCapabilitiesSchema,
  roomCodeSchema,
  roomLookupSchema,
  sessionIdSchema,
  soundboardPolicySchema,
  stageInteractionPolicySchema,
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
const MAX_PARTICIPANT_ROWS = 120
const CURSOR_STALE_MS = 15_000
const DEFAULT_STAGE_INTERACTION_POLICY: StageInteractionPolicy = {
  kind: 'everyone',
}

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

const stageInteractionPolicyValidator = v.union(
  v.object({
    kind: v.literal('owner_only'),
  }),
  v.object({
    kind: v.literal('everyone'),
  }),
)

const roomCapabilitiesValidator = v.array(v.string())

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

async function trimParticipantProfiles(ctx: any, roomCode: string): Promise<void> {
  const rows = await ctx.db
    .query('roomParticipantProfiles')
    .withIndex('by_room_last_seen', (q: any) => q.eq('roomCode', roomCode))
    .order('desc')
    .take(MAX_PARTICIPANT_ROWS + 40)

  if (rows.length <= MAX_PARTICIPANT_ROWS) {
    return
  }

  await Promise.all(
    rows.slice(MAX_PARTICIPANT_ROWS).map((row: any) => ctx.db.delete(row._id)),
  )
}

function getStageInteractionPolicy(room: {
  stageInteractionPolicy?: StageInteractionPolicy
}): StageInteractionPolicy {
  return room.stageInteractionPolicy ?? DEFAULT_STAGE_INTERACTION_POLICY
}

function hasGrantedCapability(
  capabilities: RoomCapability[],
  capability: RoomCapability,
): boolean {
  return capabilities.includes(capability)
}

async function upsertParticipantProfileRow(
  ctx: any,
  participant: {
    roomCode: string
    sessionId: string
    displayName: string
    color: string
  },
): Promise<void> {
  const existing = await ctx.db
    .query('roomParticipantProfiles')
    .withIndex('by_room_session', (q: any) =>
      q.eq('roomCode', participant.roomCode).eq('sessionId', participant.sessionId),
    )
    .first()

  const lastSeenAt = Date.now()

  if (existing) {
    await ctx.db.patch(existing._id, {
      displayName: participant.displayName,
      color: participant.color,
      lastSeenAt,
    })
  } else {
    await ctx.db.insert('roomParticipantProfiles', {
      roomCode: participant.roomCode,
      sessionId: participant.sessionId,
      displayName: participant.displayName,
      color: participant.color,
      lastSeenAt,
    })
  }

  await trimParticipantProfiles(ctx, participant.roomCode)
}

async function listParticipantCapabilityGrants(
  ctx: any,
  roomCode: string,
): Promise<Map<string, RoomCapability[]>> {
  const rows = await ctx.db
    .query('roomCapabilityGrants')
    .withIndex('by_room_updated', (q: any) => q.eq('roomCode', roomCode))
    .collect()

  return new Map(
    rows.map((row: any) => [
      row.sessionId,
      roomCapabilitiesSchema.parse(row.capabilities),
    ]),
  )
}

async function assertOwnerControl(
  ctx: any,
  room: any,
  ownerSessionId: string,
  ownerSessionSecret: string,
): Promise<void> {
  if (room.createdBySessionId !== ownerSessionId) {
    throw new ConvexError({
      code: 'not_owner',
      message: 'Only the room owner can update room settings.',
    })
  }

  if (room.ownerSessionSecret && room.ownerSessionSecret !== ownerSessionSecret) {
    throw new ConvexError({
      code: 'not_owner',
      message: 'This browser does not hold the owner key for this room.',
    })
  }

  if (!room.ownerSessionSecret || !room.stageInteractionPolicy) {
    await ctx.db.patch(room._id, {
      ownerSessionSecret,
      stageInteractionPolicy: getStageInteractionPolicy(room),
    })
  }
}

export const createRoom = mutation({
  args: {
    watchUrl: v.string(),
    ownerSessionId: v.string(),
    ownerSessionSecret: v.string(),
    ownerDisplayName: v.string(),
    ownerColor: v.string(),
    visibility: visibilityValidator,
    soundboardPolicy: soundboardPolicyValidator,
    stageInteractionPolicy: stageInteractionPolicyValidator,
  },
  handler: async (ctx, args) => {
    const parsed = createRoomSchema.parse({
      watchUrl: args.watchUrl,
      ownerSessionId: args.ownerSessionId,
      ownerSessionSecret: args.ownerSessionSecret,
      ownerDisplayName: args.ownerDisplayName,
      ownerColor: args.ownerColor,
      visibility: args.visibility,
      soundboardPolicy: args.soundboardPolicy,
      stageInteractionPolicy: args.stageInteractionPolicy,
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
      ownerSessionSecret: parsed.ownerSessionSecret,
      createdByDisplayName: parsed.ownerDisplayName,
      visibility: parsed.visibility,
      soundboardPolicy: parsed.soundboardPolicy,
      stageInteractionPolicy: parsed.stageInteractionPolicy,
      archived: false,
    })

    await upsertParticipantProfileRow(ctx, {
      roomCode,
      sessionId: parsed.ownerSessionId,
      displayName: parsed.ownerDisplayName,
      color: parsed.ownerColor,
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
    const participantProfiles = await ctx.db
      .query('roomParticipantProfiles')
      .withIndex('by_room_last_seen', (q: any) => q.eq('roomCode', parsed.roomCode))
      .order('desc')
      .collect()
    const capabilityGrantsBySessionId = await listParticipantCapabilityGrants(
      ctx,
      parsed.roomCode,
    )
    const onlineBySessionId = new Map(
      participants.map((participant) => [participant.userId, participant.online]),
    )

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
        stageInteractionPolicy: getStageInteractionPolicy(room),
        participantCount: participants.filter((participant) => participant.online)
          .length,
        participants: participantProfiles.map((participant) => {
          const capabilities =
            capabilityGrantsBySessionId.get(participant.sessionId) ?? []

          return {
            sessionId: participant.sessionId,
            displayName: participant.displayName,
            color: participant.color,
            online: onlineBySessionId.get(participant.sessionId) ?? false,
            capabilities,
            canControlStage:
              participant.sessionId === room.createdBySessionId ||
              getStageInteractionPolicy(room).kind === 'everyone' ||
              hasGrantedCapability(capabilities, 'stage_control'),
          }
        }),
      },
    }
  },
})

export const upsertParticipantProfile = mutation({
  args: {
    roomCode: v.string(),
    sessionId: v.string(),
    displayName: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = {
      roomCode: roomCodeSchema.parse(args.roomCode),
      sessionId: sessionIdSchema.parse(args.sessionId),
      displayName: displayNameSchema.parse(args.displayName),
      color: colorSchema.parse(args.color),
    }

    const room = await findRoomByCode(ctx, participant.roomCode)
    if (!room || room.archived) {
      throw new ConvexError({
        code: 'room_not_found',
        message: 'Room was not found.',
      })
    }

    await upsertParticipantProfileRow(ctx, participant)
    await ctx.db.patch(room._id, {
      lastActivityAt: Date.now(),
    })

    return {
      ok: true,
    }
  },
})

export const updateSoundboardPolicy = mutation({
  args: {
    roomCode: v.string(),
    ownerSessionId: v.string(),
    ownerSessionSecret: v.string(),
    soundboardPolicy: soundboardPolicyValidator,
  },
  handler: async (ctx, args) => {
    const roomCode = roomCodeSchema.parse(args.roomCode)
    const ownerSessionId = sessionIdSchema.parse(args.ownerSessionId)
    const ownerSessionSecret = ownerSessionSecretSchema.parse(args.ownerSessionSecret)
    const soundboardPolicy = soundboardPolicySchema.parse(args.soundboardPolicy)

    const room = await findRoomByCode(ctx, roomCode)

    if (!room || room.archived) {
      throw new ConvexError({
        code: 'room_not_found',
        message: 'Room was not found.',
      })
    }

    await assertOwnerControl(ctx, room, ownerSessionId, ownerSessionSecret)

    await ctx.db.patch(room._id, {
      soundboardPolicy,
      lastActivityAt: Date.now(),
    })

    return {
      ok: true,
    }
  },
})

export const updateStageInteractionPolicy = mutation({
  args: {
    roomCode: v.string(),
    ownerSessionId: v.string(),
    ownerSessionSecret: v.string(),
    stageInteractionPolicy: stageInteractionPolicyValidator,
  },
  handler: async (ctx, args) => {
    const roomCode = roomCodeSchema.parse(args.roomCode)
    const ownerSessionId = sessionIdSchema.parse(args.ownerSessionId)
    const ownerSessionSecret = ownerSessionSecretSchema.parse(args.ownerSessionSecret)
    const stageInteractionPolicy = stageInteractionPolicySchema.parse(
      args.stageInteractionPolicy,
    )

    const room = await findRoomByCode(ctx, roomCode)

    if (!room || room.archived) {
      throw new ConvexError({
        code: 'room_not_found',
        message: 'Room was not found.',
      })
    }

    await assertOwnerControl(ctx, room, ownerSessionId, ownerSessionSecret)

    await ctx.db.patch(room._id, {
      stageInteractionPolicy,
      lastActivityAt: Date.now(),
    })

    return {
      ok: true,
    }
  },
})

export const setParticipantCapabilities = mutation({
  args: {
    roomCode: v.string(),
    ownerSessionId: v.string(),
    ownerSessionSecret: v.string(),
    participantSessionId: v.string(),
    capabilities: roomCapabilitiesValidator,
  },
  handler: async (ctx, args) => {
    const roomCode = roomCodeSchema.parse(args.roomCode)
    const ownerSessionId = sessionIdSchema.parse(args.ownerSessionId)
    const ownerSessionSecret = ownerSessionSecretSchema.parse(args.ownerSessionSecret)
    const participantSessionId = sessionIdSchema.parse(args.participantSessionId)
    const capabilities = roomCapabilitiesSchema.parse(args.capabilities)

    const room = await findRoomByCode(ctx, roomCode)

    if (!room || room.archived) {
      throw new ConvexError({
        code: 'room_not_found',
        message: 'Room was not found.',
      })
    }

    await assertOwnerControl(ctx, room, ownerSessionId, ownerSessionSecret)

    if (participantSessionId === room.createdBySessionId) {
      throw new ConvexError({
        code: 'invalid_participant',
        message: 'Owner capabilities are implicit and cannot be edited here.',
      })
    }

    const existingGrant = await ctx.db
      .query('roomCapabilityGrants')
      .withIndex('by_room_session', (q: any) =>
        q.eq('roomCode', roomCode).eq('sessionId', participantSessionId),
      )
      .first()

    if (capabilities.length === 0) {
      if (existingGrant) {
        await ctx.db.delete(existingGrant._id)
      }
    } else if (existingGrant) {
      await ctx.db.patch(existingGrant._id, {
        capabilities,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert('roomCapabilityGrants', {
        roomCode,
        sessionId: participantSessionId,
        capabilities,
        updatedAt: Date.now(),
      })
    }

    await ctx.db.patch(room._id, {
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

    await upsertParticipantProfileRow(ctx, {
      roomCode: parsed.roomCode,
      sessionId: parsed.sessionId,
      displayName: parsed.displayName,
      color: parsed.color,
    })

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
    color: v.string(),
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

    await upsertParticipantProfileRow(ctx, {
      roomCode: parsed.roomCode,
      sessionId: parsed.sessionId,
      displayName: parsed.displayName,
      color: parsed.color,
    })

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

    const participantProfiles = await ctx.db
      .query('roomParticipantProfiles')
      .withIndex('by_room_last_seen', (q: any) => q.eq('roomCode', roomCode))
      .collect()

    const capabilityGrants = await ctx.db
      .query('roomCapabilityGrants')
      .withIndex('by_room_updated', (q: any) => q.eq('roomCode', roomCode))
      .collect()

    await Promise.all([
      ...cursors.map((cursor) => ctx.db.delete(cursor._id)),
      ...sounds.map((sound) => ctx.db.delete(sound._id)),
      ...participantProfiles.map((participant) => ctx.db.delete(participant._id)),
      ...capabilityGrants.map((grant) => ctx.db.delete(grant._id)),
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
      stageInteractionPolicy: DEFAULT_STAGE_INTERACTION_POLICY,
    }
  },
})
