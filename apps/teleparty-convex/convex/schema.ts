import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

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

export default defineSchema({
  rooms: defineTable({
    roomCode: v.string(),
    watchUrl: v.string(),
    watchHost: v.string(),
    createdAt: v.number(),
    lastActivityAt: v.number(),
    createdBySessionId: v.string(),
    createdByDisplayName: v.string(),
    visibility: visibilityValidator,
    soundboardPolicy: soundboardPolicyValidator,
    archived: v.boolean(),
    archivedAt: v.optional(v.number()),
  })
    .index('by_room_code', ['roomCode'])
    .index('by_visibility_created', ['visibility.kind', 'createdAt'])
    .index('by_archived_created', ['archived', 'createdAt']),

  cursorStates: defineTable({
    roomCode: v.string(),
    sessionId: v.string(),
    displayName: v.string(),
    color: v.string(),
    x: v.number(),
    y: v.number(),
    updatedAt: v.number(),
  })
    .index('by_room_session', ['roomCode', 'sessionId'])
    .index('by_room_updated', ['roomCode', 'updatedAt']),

  soundboardEvents: defineTable({
    eventId: v.string(),
    roomCode: v.string(),
    soundId: v.string(),
    actorSessionId: v.string(),
    actorDisplayName: v.string(),
    createdAt: v.number(),
  })
    .index('by_room_event', ['roomCode', 'eventId'])
    .index('by_room_created', ['roomCode', 'createdAt']),
})
