import { SenderError } from 'spacetimedb'
import { schema, table, t } from 'spacetimedb/server'

const DEFAULT_AUTO_SOUNDBOARD_CAPACITY = 8
const ROOM_IDLE_TTL_MS = 30 * 60 * 1000
const PARTICIPANT_STALE_TTL_MS = 20 * 1000
const MAX_SOUND_EVENTS = 120
const MAX_DRAWING_STROKES = 250

const SOUND_IDS = new Set([
  'airhorn',
  'rimshot',
  'cheer',
  'boo',
  'ta-da',
  'whoosh',
])

const spacetimedb = schema({
  room: table(
    { public: true },
    {
      roomCode: t.string().primaryKey(),
      watchUrl: t.string(),
      watchHost: t.string().index(),
      visibility: t.string().index(),
      accessCode: t.string(),
      ownerSessionId: t.string().index(),
      ownerDisplayName: t.string(),
      soundboardMode: t.string(),
      autoSoundboardCapacity: t.u16(),
      manualSoundboardEnabled: t.bool(),
      manualSoundboardCapacity: t.u16(),
      createdAtMs: t.f64(),
      lastActivityAtMs: t.f64(),
      archived: t.bool().index(),
    },
  ),

  participant: table(
    { public: true },
    {
      participantKey: t.string().primaryKey(),
      roomCode: t.string().index(),
      sessionId: t.string().index(),
      displayName: t.string(),
      color: t.string(),
      cursorX: t.f32(),
      cursorY: t.f32(),
      connectionId: t.connectionId().index(),
      lastSeenAtMs: t.f64(),
    },
  ),

  soundEvent: table(
    { public: true },
    {
      eventId: t.string().primaryKey(),
      roomCode: t.string().index(),
      sessionId: t.string().index(),
      actorDisplayName: t.string(),
      soundId: t.string().index(),
      createdAtMs: t.f64(),
    },
  ),

  drawingStroke: table(
    { public: true },
    {
      strokeId: t.string().primaryKey(),
      roomCode: t.string().index(),
      sessionId: t.string().index(),
      color: t.string(),
      pointsJson: t.string(),
      createdAtMs: t.f64(),
    },
  ),
})

export default spacetimedb

function nowMs(ctx: { timestamp: { toMillis(): bigint } }): number {
  return Number(ctx.timestamp.toMillis())
}

function normalizeRoomCode(value: string): string {
  const roomCode = value.trim().toUpperCase()
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(roomCode)) {
    throw new SenderError('Room code must be 6 characters (A-Z without I/O, and 2-9).')
  }
  return roomCode
}

function normalizeAccessCode(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeDisplayName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 24) {
    throw new SenderError('Display names must be 2 to 24 characters long.')
  }
  return name
}

function normalizeSessionId(value: string): string {
  const sessionId = value.trim()
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(sessionId)) {
    throw new SenderError('Invalid session id.')
  }
  return sessionId
}

type ParsedWatchUrl = {
  normalized: string
  host: string
}

function parseWatchUrl(raw: string): ParsedWatchUrl {
  const trimmed = raw.trim()
  const match = trimmed.match(
    /^(https?):\/\/((?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+|\[[a-fA-F0-9:.]+\])(?::\d{1,5})?(?:\/[^\s]*)?$/iu,
  )

  if (!match) {
    throw new SenderError('Watch URL must be a valid URL.')
  }

  const protocol = match[1]?.toLowerCase()
  const authority = match[2]
  if (!protocol || !authority) {
    throw new SenderError('Watch URL must be a valid URL.')
  }

  const host = authority.toLowerCase()
  return {
    normalized: trimmed,
    host,
  }
}

function normalizeColor(value: string): string {
  const color = value.trim().toLowerCase()
  if (!/^#[a-f0-9]{6}$/.test(color)) {
    throw new SenderError('Cursor color must be a hex color like #22c55e.')
  }
  return color
}

function normalizeDrawingPoints(value: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new SenderError('Drawing payload must be valid JSON.')
  }

  if (!Array.isArray(parsed) || parsed.length < 2 || parsed.length > 256) {
    throw new SenderError('Drawings must include between 2 and 256 points.')
  }

  const points = parsed.map((point) => {
    if (
      !point ||
      typeof point !== 'object' ||
      typeof point.x !== 'number' ||
      typeof point.y !== 'number'
    ) {
      throw new SenderError('Each drawing point must have numeric x/y coordinates.')
    }

    return {
      x: Math.max(0, Math.min(point.x, 1)),
      y: Math.max(0, Math.min(point.y, 1)),
    }
  })

  return JSON.stringify(points)
}

function participantKey(roomCode: string, sessionId: string): string {
  return `${roomCode}:${sessionId}`
}

function countParticipants(ctx: any, roomCode: string): number {
  return Array.from(ctx.db.participant.roomCode.filter(roomCode)).length
}

function soundboardAllowed(room: any, participantCount: number): boolean {
  if (room.soundboardMode === 'auto') {
    return participantCount <= room.autoSoundboardCapacity
  }

  if (room.soundboardMode === 'manual') {
    return room.manualSoundboardEnabled && participantCount <= room.manualSoundboardCapacity
  }

  return false
}

function replaceRoom(ctx: any, room: any, patch: Record<string, unknown>) {
  ctx.db.room.delete(room)
  ctx.db.room.insert({
    ...room,
    ...patch,
  })
}

function replaceParticipant(ctx: any, participant: any, patch: Record<string, unknown>) {
  ctx.db.participant.delete(participant)
  ctx.db.participant.insert({
    ...participant,
    ...patch,
  })
}

function getRoomOrThrow(ctx: any, roomCode: string) {
  const room = ctx.db.room.roomCode.find(roomCode)
  if (!room || room.archived) {
    throw new SenderError('Room not found or archived.')
  }
  return room
}

function trimSoundEvents(ctx: any, roomCode: string) {
  const rows = Array.from(ctx.db.soundEvent.roomCode.filter(roomCode)) as any[]
  rows.sort((a, b) => b.createdAtMs - a.createdAtMs)

  if (rows.length <= MAX_SOUND_EVENTS) {
    return
  }

  for (const row of rows.slice(MAX_SOUND_EVENTS)) {
    ctx.db.soundEvent.delete(row)
  }
}

function trimDrawingStrokes(ctx: any, roomCode: string) {
  const rows = Array.from(ctx.db.drawingStroke.roomCode.filter(roomCode)) as any[]
  rows.sort((a, b) => b.createdAtMs - a.createdAtMs)

  if (rows.length <= MAX_DRAWING_STROKES) {
    return
  }

  for (const row of rows.slice(MAX_DRAWING_STROKES)) {
    ctx.db.drawingStroke.delete(row)
  }
}

function cleanupStaleParticipants(ctx: any, roomCode: string) {
  const cutoff = nowMs(ctx) - PARTICIPANT_STALE_TTL_MS
  for (const participant of ctx.db.participant.roomCode.filter(roomCode)) {
    if (participant.lastSeenAtMs < cutoff) {
      ctx.db.participant.delete(participant)
    }
  }
}

export const createRoom = spacetimedb.reducer(
  {
    roomCode: t.string(),
    watchUrl: t.string(),
    ownerSessionId: t.string(),
    ownerDisplayName: t.string(),
    visibility: t.string(),
    accessCode: t.string(),
    soundboardMode: t.string(),
    soundboardEnabled: t.bool(),
    soundboardCapacity: t.u16(),
  },
  (ctx, args) => {
    const roomCode = normalizeRoomCode(args.roomCode)
    const ownerSessionId = normalizeSessionId(args.ownerSessionId)
    const ownerDisplayName = normalizeDisplayName(args.ownerDisplayName)
    const { normalized: watchUrl, host: watchHost } = parseWatchUrl(args.watchUrl)

    if (ctx.db.room.roomCode.find(roomCode)) {
      throw new SenderError('Room code already exists. Generate a new code.')
    }

    const visibility = args.visibility === 'private' ? 'private' : 'public'
    const accessCode = visibility === 'private' ? normalizeAccessCode(args.accessCode) : ''

    const requestedCapacity = Math.max(2, Math.min(args.soundboardCapacity, 64))
    const soundboardMode = args.soundboardMode === 'manual' ? 'manual' : 'auto'

    const createdAt = nowMs(ctx)

    ctx.db.room.insert({
      roomCode,
      watchUrl,
      watchHost,
      visibility,
      accessCode,
      ownerSessionId,
      ownerDisplayName,
      soundboardMode,
      autoSoundboardCapacity: DEFAULT_AUTO_SOUNDBOARD_CAPACITY,
      manualSoundboardEnabled: Boolean(args.soundboardEnabled),
      manualSoundboardCapacity: requestedCapacity,
      createdAtMs: createdAt,
      lastActivityAtMs: createdAt,
      archived: false,
    })
  },
)

export const joinRoom = spacetimedb.reducer(
  {
    roomCode: t.string(),
    accessCode: t.string(),
    sessionId: t.string(),
    displayName: t.string(),
    color: t.string(),
  },
  (ctx, args) => {
    if (!ctx.connectionId) {
      throw new SenderError('Connection id missing.')
    }

    const roomCode = normalizeRoomCode(args.roomCode)
    const room = getRoomOrThrow(ctx, roomCode)

    if (room.visibility === 'private') {
      if (room.accessCode !== normalizeAccessCode(args.accessCode)) {
        throw new SenderError('Incorrect access code for private room.')
      }
    }

    const sessionId = normalizeSessionId(args.sessionId)
    const displayName = normalizeDisplayName(args.displayName)
    const color = normalizeColor(args.color)

    const key = participantKey(roomCode, sessionId)
    const existing = ctx.db.participant.participantKey.find(key)

    if (existing) {
      ctx.db.participant.delete(existing)
    }

    const currentTime = nowMs(ctx)

    ctx.db.participant.insert({
      participantKey: key,
      roomCode,
      sessionId,
      displayName,
      color,
      cursorX: 0.5,
      cursorY: 0.5,
      connectionId: ctx.connectionId,
      lastSeenAtMs: currentTime,
    })

    replaceRoom(ctx, room, {
      lastActivityAtMs: currentTime,
    })
  },
)

export const leaveRoom = spacetimedb.reducer(
  {
    roomCode: t.string(),
    sessionId: t.string(),
  },
  (ctx, args) => {
    const roomCode = normalizeRoomCode(args.roomCode)
    const sessionId = normalizeSessionId(args.sessionId)

    const room = getRoomOrThrow(ctx, roomCode)

    const existing = ctx.db.participant.participantKey.find(
      participantKey(roomCode, sessionId),
    )

    if (existing) {
      ctx.db.participant.delete(existing)
      replaceRoom(ctx, room, {
        lastActivityAtMs: nowMs(ctx),
      })
    }
  },
)

export const updateCursor = spacetimedb.reducer(
  {
    roomCode: t.string(),
    sessionId: t.string(),
    x: t.f32(),
    y: t.f32(),
  },
  (ctx, args) => {
    const roomCode = normalizeRoomCode(args.roomCode)
    const sessionId = normalizeSessionId(args.sessionId)

    const room = getRoomOrThrow(ctx, roomCode)

    const existing = ctx.db.participant.participantKey.find(
      participantKey(roomCode, sessionId),
    )

    if (!existing) {
      throw new SenderError('Join room before publishing cursor updates.')
    }

    const x = Math.max(0, Math.min(args.x, 1))
    const y = Math.max(0, Math.min(args.y, 1))
    const currentTime = nowMs(ctx)

    replaceParticipant(ctx, existing, {
      cursorX: x,
      cursorY: y,
      lastSeenAtMs: currentTime,
    })

    replaceRoom(ctx, room, {
      lastActivityAtMs: currentTime,
    })
  },
)

export const triggerSound = spacetimedb.reducer(
  {
    roomCode: t.string(),
    sessionId: t.string(),
    soundId: t.string(),
  },
  (ctx, args) => {
    const roomCode = normalizeRoomCode(args.roomCode)
    const sessionId = normalizeSessionId(args.sessionId)

    const room = getRoomOrThrow(ctx, roomCode)

    if (!SOUND_IDS.has(args.soundId)) {
      throw new SenderError('Unknown sound id.')
    }

    const participant = ctx.db.participant.participantKey.find(
      participantKey(roomCode, sessionId),
    )

    if (!participant) {
      throw new SenderError('Join room before using the soundboard.')
    }

    cleanupStaleParticipants(ctx, roomCode)
    const activeCount = countParticipants(ctx, roomCode)

    if (!soundboardAllowed(room, activeCount)) {
      throw new SenderError('Soundboard disabled for current room size.')
    }

    const currentTime = nowMs(ctx)

    ctx.db.soundEvent.insert({
      eventId: `${roomCode}-${sessionId}-${currentTime}-${args.soundId}`,
      roomCode,
      sessionId,
      actorDisplayName: participant.displayName,
      soundId: args.soundId,
      createdAtMs: currentTime,
    })

    replaceRoom(ctx, room, {
      lastActivityAtMs: currentTime,
    })

    trimSoundEvents(ctx, roomCode)
  },
)

export const addDrawingStroke = spacetimedb.reducer(
  {
    roomCode: t.string(),
    sessionId: t.string(),
    color: t.string(),
    pointsJson: t.string(),
  },
  (ctx, args) => {
    const roomCode = normalizeRoomCode(args.roomCode)
    const sessionId = normalizeSessionId(args.sessionId)
    const color = normalizeColor(args.color)
    const pointsJson = normalizeDrawingPoints(args.pointsJson)

    const room = getRoomOrThrow(ctx, roomCode)
    const participant = ctx.db.participant.participantKey.find(
      participantKey(roomCode, sessionId),
    )

    if (!participant) {
      throw new SenderError('Join room before drawing.')
    }

    const currentTime = nowMs(ctx)

    ctx.db.drawingStroke.insert({
      strokeId: `${roomCode}-${sessionId}-${currentTime}`,
      roomCode,
      sessionId,
      color,
      pointsJson,
      createdAtMs: currentTime,
    })

    replaceRoom(ctx, room, {
      lastActivityAtMs: currentTime,
    })

    trimDrawingStrokes(ctx, roomCode)
  },
)

export const clearDrawingStrokes = spacetimedb.reducer(
  {
    roomCode: t.string(),
    ownerSessionId: t.string(),
  },
  (ctx, args) => {
    const roomCode = normalizeRoomCode(args.roomCode)
    const ownerSessionId = normalizeSessionId(args.ownerSessionId)
    const room = getRoomOrThrow(ctx, roomCode)

    if (room.ownerSessionId !== ownerSessionId) {
      throw new SenderError('Only room owner can clear drawings.')
    }

    for (const stroke of ctx.db.drawingStroke.roomCode.filter(roomCode)) {
      ctx.db.drawingStroke.delete(stroke)
    }

    replaceRoom(ctx, room, {
      lastActivityAtMs: nowMs(ctx),
    })
  },
)

export const updateSoundboardPolicy = spacetimedb.reducer(
  {
    roomCode: t.string(),
    ownerSessionId: t.string(),
    mode: t.string(),
    enabled: t.bool(),
    maxParticipants: t.u16(),
  },
  (ctx, args) => {
    const roomCode = normalizeRoomCode(args.roomCode)
    const ownerSessionId = normalizeSessionId(args.ownerSessionId)

    const room = getRoomOrThrow(ctx, roomCode)

    if (room.ownerSessionId !== ownerSessionId) {
      throw new SenderError('Only room owner can change room policy.')
    }

    const mode = args.mode === 'manual' ? 'manual' : 'auto'
    const maxParticipants = Math.max(2, Math.min(args.maxParticipants, 64))

    replaceRoom(ctx, room, {
      soundboardMode: mode,
      manualSoundboardEnabled: Boolean(args.enabled),
      manualSoundboardCapacity: maxParticipants,
      lastActivityAtMs: nowMs(ctx),
    })
  },
)

export const cleanupRoom = spacetimedb.reducer(
  {
    roomCode: t.string(),
  },
  (ctx, args) => {
    const roomCode = normalizeRoomCode(args.roomCode)
    const room = getRoomOrThrow(ctx, roomCode)

    cleanupStaleParticipants(ctx, roomCode)

    const participantCount = countParticipants(ctx, roomCode)
    const currentTime = nowMs(ctx)

    if (participantCount === 0 && room.lastActivityAtMs < currentTime - ROOM_IDLE_TTL_MS) {
      for (const stroke of ctx.db.drawingStroke.roomCode.filter(roomCode)) {
        ctx.db.drawingStroke.delete(stroke)
      }
      replaceRoom(ctx, room, {
        archived: true,
        lastActivityAtMs: currentTime,
      })
    }
  },
)

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  if (!ctx.connectionId) {
    return
  }

  const participants = Array.from(ctx.db.participant.connectionId.filter(ctx.connectionId))

  for (const participant of participants) {
    ctx.db.participant.delete(participant)

    const room = ctx.db.room.roomCode.find(participant.roomCode)
    if (!room || room.archived) {
      continue
    }

    replaceRoom(ctx, room, {
      lastActivityAtMs: nowMs(ctx),
    })
  }
})
