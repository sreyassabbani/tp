import { Presence } from '@convex-dev/presence'
import { v } from 'convex/values'
import { components } from './_generated/api'
import { mutation, query } from './_generated/server'

export const roomPresence = new Presence(components.presence)

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, args) => {
    return roomPresence.heartbeat(ctx, args.roomId, args.userId, args.sessionId, args.interval)
  },
})

export const list = query({
  args: {
    roomToken: v.string(),
  },
  handler: async (ctx, args) => {
    return roomPresence.list(ctx, args.roomToken)
  },
})

export const disconnect = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    return roomPresence.disconnect(ctx, args.sessionToken)
  },
})
