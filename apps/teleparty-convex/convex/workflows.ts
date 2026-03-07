import { WorkflowManager } from '@convex-dev/workflow'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'

export const ROOM_IDLE_TTL_MS = 30 * 60 * 1000

export const roomWorkflows = new WorkflowManager(components.workflow)

export const expireRoomAfterIdle = roomWorkflows.define({
  args: {
    roomCode: v.string(),
  },
  handler: async (step, args): Promise<void> => {
    await step.runMutation(
      internal.rooms.archiveRoomIfIdle,
      {
        roomCode: args.roomCode,
      },
      {
        runAfter: ROOM_IDLE_TTL_MS,
      },
    )
  },
})
