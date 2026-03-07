import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducer, useTable } from 'spacetimedb/react'
import { reducers, tables } from '#/module_bindings'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { StageCursor } from '#/components/stage-cursor'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Slider } from '#/components/ui/slider'
import { Switch } from '#/components/ui/switch'
import { getRelativeCursorPosition } from '#/lib/cursor-stage'
import {
  canUseSoundboard,
  getWatchFrameUrl,
  normalizeRoomCode,
  type SoundboardPolicy,
} from '#/lib/teleparty-domain'
import { useSessionProfile } from '#/lib/session'
import { playSound, sounds } from '#/lib/soundboard'

export const Route = createFileRoute('/rooms/$roomCode')({
  component: RoomRoute,
})

const CURSOR_SEND_INTERVAL_MS = 40

function sameSoundboardPolicy(
  left: SoundboardPolicy,
  right: SoundboardPolicy,
): boolean {
  if (left.kind !== right.kind) {
    return false
  }

  if (left.kind === 'manual' && right.kind === 'manual') {
    return (
      left.enabled === right.enabled &&
      left.maxParticipants === right.maxParticipants
    )
  }

  if (left.kind === 'auto' && right.kind === 'auto') {
    return left.defaultMaxParticipants === right.defaultMaxParticipants
  }

  return false
}

function roomToSoundboardPolicy(room: {
  autoSoundboardCapacity: number
  manualSoundboardCapacity: number
  manualSoundboardEnabled: boolean
  soundboardMode: string
}): SoundboardPolicy {
  if (room.soundboardMode === 'manual') {
    return {
      kind: 'manual',
      enabled: room.manualSoundboardEnabled,
      maxParticipants: room.manualSoundboardCapacity,
    }
  }

  return {
    kind: 'auto',
    defaultMaxParticipants: room.autoSoundboardCapacity,
  }
}

function soundboardPolicyToReducerInput(policy: SoundboardPolicy): {
  enabled: boolean
  maxParticipants: number
  mode: 'auto' | 'manual'
} {
  if (policy.kind === 'manual') {
    return {
      mode: 'manual',
      enabled: policy.enabled,
      maxParticipants: policy.maxParticipants,
    }
  }

  return {
    mode: 'auto',
    enabled: true,
    maxParticipants: policy.defaultMaxParticipants,
  }
}

function RoomRoute() {
  const params = Route.useParams()
  const { sessionProfile, isHydrated } = useSessionProfile()

  const joinRoom = useReducer(reducers.joinRoom)
  const leaveRoom = useReducer(reducers.leaveRoom)
  const updateCursor = useReducer(reducers.updateCursor)
  const triggerSound = useReducer(reducers.triggerSound)
  const updateSoundboardPolicy = useReducer(reducers.updateSoundboardPolicy)
  const cleanupRoom = useReducer(reducers.cleanupRoom)

  const [hasJoined, setHasJoined] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const [draftAccessCode, setDraftAccessCode] = useState('')
  const [submittedAccessCode, setSubmittedAccessCode] = useState('')

  const [ownerDraftPolicy, setOwnerDraftPolicy] = useState<SoundboardPolicy | null>(
    null,
  )

  const [soundError, setSoundError] = useState<string | null>(null)
  const [optimisticCursor, setOptimisticCursor] = useState<{
    color: string
    displayName: string
    participantKey: string
    sessionId: string
    x: number
    y: number
  } | null>(null)

  const roomCode = useMemo(() => {
    try {
      return normalizeRoomCode(params.roomCode)
    } catch {
      return null
    }
  }, [params.roomCode])

  const activeRoomCode = roomCode ?? '__invalid_room__'

  const [roomRows, roomRowsReady] = useTable(
    tables.room.where((room) => room.roomCode.eq(activeRoomCode)),
  )

  const [participantRows, participantRowsReady] = useTable(
    tables.participant.where((participant) => participant.roomCode.eq(activeRoomCode)),
  )

  const [soundRows, soundRowsReady] = useTable(
    tables.soundEvent.where((soundEvent) => soundEvent.roomCode.eq(activeRoomCode)),
  )

  const room = useMemo(() => {
    if (!roomCode) {
      return null
    }
    return roomRows[0] ?? null
  }, [roomCode, roomRows])

  const watchFrameUrl = useMemo(() => {
    if (!room) {
      return null
    }
    return getWatchFrameUrl(room.watchUrl)
  }, [room])

  const roomParticipants = useMemo(() => {
    if (!roomCode) {
      return []
    }
    return participantRows
  }, [participantRows, roomCode])

  const roomSoundEvents = useMemo(() => {
    if (!roomCode) {
      return []
    }
    return [...soundRows]
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
  }, [roomCode, soundRows])

  const roomPolicy = useMemo(() => {
    if (!room) {
      return null
    }
    return roomToSoundboardPolicy(room)
  }, [room])

  const roomPolicySignature = useMemo(() => {
    if (!roomPolicy) {
      return null
    }
    return JSON.stringify(roomPolicy)
  }, [roomPolicy])

  const lastSyncedPolicySignature = useRef<string | null>(null)

  useEffect(() => {
    if (!roomPolicy || !roomPolicySignature) {
      lastSyncedPolicySignature.current = null
      setOwnerDraftPolicy(null)
      return
    }
    if (lastSyncedPolicySignature.current === roomPolicySignature) {
      return
    }
    lastSyncedPolicySignature.current = roomPolicySignature
    setOwnerDraftPolicy(roomPolicy)
  }, [roomCode, roomPolicy, roomPolicySignature])

  const effectiveOwnerPolicy = ownerDraftPolicy ?? roomPolicy

  const settingsDirty = useMemo(() => {
    if (!effectiveOwnerPolicy || !roomPolicy) {
      return false
    }
    return !sameSoundboardPolicy(effectiveOwnerPolicy, roomPolicy)
  }, [effectiveOwnerPolicy, roomPolicy])

  const joiningRef = useRef(false)

  useEffect(() => {
    if (!isHydrated || !room || hasJoined || joiningRef.current) {
      return
    }

    if (room.visibility !== 'public') {
      return
    }

    joiningRef.current = true
    joinRoom({
      roomCode: room.roomCode,
      accessCode: '',
      sessionId: sessionProfile.sessionId,
      displayName: sessionProfile.displayName,
      color: sessionProfile.color,
    })
      .then(() => {
        setHasJoined(true)
        setJoinError(null)
      })
      .catch((error) => {
        setJoinError(error instanceof Error ? error.message : 'Join failed.')
      })
      .finally(() => {
        joiningRef.current = false
      })
  }, [
    hasJoined,
    isHydrated,
    joinRoom,
    room,
    sessionProfile.color,
    sessionProfile.displayName,
    sessionProfile.sessionId,
  ])

  useEffect(() => {
    if (!hasJoined || !roomCode) {
      return
    }

    const interval = window.setInterval(() => {
      cleanupRoom({ roomCode }).catch(() => {
        // ignore cleanup errors in interval loop
      })
    }, 10_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [cleanupRoom, hasJoined, roomCode])

  useEffect(() => {
    return () => {
      if (!isHydrated || !roomCode || !hasJoined) {
        return
      }
      leaveRoom({ roomCode, sessionId: sessionProfile.sessionId }).catch(() => {
        // ignore on unmount
      })
    }
  }, [hasJoined, isHydrated, leaveRoom, roomCode, sessionProfile.sessionId])

  const seenSoundEvents = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const event of roomSoundEvents) {
      if (seenSoundEvents.current.has(event.eventId)) {
        continue
      }
      seenSoundEvents.current.add(event.eventId)
      const sound = sounds.find((item) => item.id === event.soundId)
      if (sound) {
        playSound(sound.id)
      }
    }
  }, [roomSoundEvents])

  const cursorContainerRef = useRef<HTMLDivElement | null>(null)
  const lastCursorSentAt = useRef(0)
  const cursorFlushTimeout = useRef<number | null>(null)
  const cursorReducerInFlight = useRef(false)
  const pendingCursorPayload = useRef<{
    roomCode: string
    sessionId: string
    x: number
    y: number
  } | null>(null)

  useEffect(() => {
    return () => {
      if (cursorFlushTimeout.current !== null) {
        window.clearTimeout(cursorFlushTimeout.current)
      }
    }
  }, [])

  function scheduleCursorFlush(delayMs: number) {
    if (cursorFlushTimeout.current !== null) {
      return
    }

    cursorFlushTimeout.current = window.setTimeout(() => {
      cursorFlushTimeout.current = null
      void flushCursorUpdate()
    }, delayMs)
  }

  async function flushCursorUpdate() {
    if (cursorReducerInFlight.current) {
      return
    }

    const payload = pendingCursorPayload.current
    if (!payload) {
      return
    }

    const elapsed = Date.now() - lastCursorSentAt.current
    if (elapsed < CURSOR_SEND_INTERVAL_MS) {
      scheduleCursorFlush(CURSOR_SEND_INTERVAL_MS - elapsed)
      return
    }

    pendingCursorPayload.current = null
    cursorReducerInFlight.current = true
    lastCursorSentAt.current = Date.now()

    try {
      await updateCursor(payload)
    } catch {
      // Ignore transient reducer failures; the next move retries with latest state.
    } finally {
      cursorReducerInFlight.current = false
      if (pendingCursorPayload.current) {
        void flushCursorUpdate()
      }
    }
  }

  async function onCursorMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!roomCode || !room || !hasJoined) {
      return
    }

    const area = cursorContainerRef.current
    if (!area) {
      return
    }

    const cursorPosition = getRelativeCursorPosition(
      area.getBoundingClientRect(),
      event,
    )
    if (!cursorPosition) {
      return
    }

    const payload = {
      roomCode,
      sessionId: sessionProfile.sessionId,
      x: cursorPosition.x,
      y: cursorPosition.y,
    }

    setOptimisticCursor({
      color: sessionProfile.color,
      displayName: sessionProfile.displayName,
      participantKey: `${roomCode}:${sessionProfile.sessionId}`,
      sessionId: sessionProfile.sessionId,
      x: payload.x,
      y: payload.y,
    })

    pendingCursorPayload.current = payload
    void flushCursorUpdate()
  }

  async function onSoundButtonClick(soundId: (typeof sounds)[number]['id']) {
    if (!roomCode || !room || !hasJoined) {
      return
    }

    try {
      await triggerSound({
        roomCode,
        sessionId: sessionProfile.sessionId,
        soundId,
      })
      setSoundError(null)
    } catch (error) {
      setSoundError(error instanceof Error ? error.message : 'Sound request failed.')
    }
  }

  async function onSaveSoundboardSettings() {
    if (!roomCode || !room || !effectiveOwnerPolicy) {
      return
    }

    await updateSoundboardPolicy({
      roomCode,
      ownerSessionId: sessionProfile.sessionId,
      ...soundboardPolicyToReducerInput(effectiveOwnerPolicy),
    })

    setOwnerDraftPolicy(null)
  }

  async function onPrivateRoomSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isHydrated || !roomCode || !room) {
      return
    }

    try {
      setSubmittedAccessCode(draftAccessCode)
      await joinRoom({
        roomCode,
        accessCode: draftAccessCode,
        sessionId: sessionProfile.sessionId,
        displayName: sessionProfile.displayName,
        color: sessionProfile.color,
      })
      setHasJoined(true)
      setJoinError(null)
    } catch (error) {
      setHasJoined(false)
      setJoinError(error instanceof Error ? error.message : 'Failed to join room.')
    }
  }

  if (!roomCode) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Invalid room code</CardTitle>
            <CardDescription>
              Room codes use six characters from A-Z (without I/O) and 2-9.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  if (!room) {
    if (!roomRowsReady) {
      return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Loading room</CardTitle>
              <CardDescription>
                Waiting for the room subscription to sync.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      )
    }

    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Room not found</CardTitle>
            <CardDescription>
              The room may not exist yet or may have been archived.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  if (room.visibility === 'private' && !hasJoined) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Private Room</CardTitle>
            <CardDescription>
              Enter the access code for room {roomCode}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onPrivateRoomSubmit}>
              <div className="space-y-2">
                <Label htmlFor="access-code">Access code</Label>
                <Input
                  id="access-code"
                  value={draftAccessCode}
                  onChange={(event) => setDraftAccessCode(event.target.value)}
                />
              </div>
              {joinError ? (
                <p className="m-0 text-xs text-destructive">{joinError}</p>
              ) : null}
              <Button type="submit">Join Room</Button>
            </form>
            {submittedAccessCode ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Last submitted code: <code>{submittedAccessCode}</code>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </main>
    )
  }

  const participantCount = roomParticipants.length
  const soundboardEnabled = roomPolicy
    ? canUseSoundboard(roomPolicy, participantCount)
    : false

  const isOwner = room.ownerSessionId === sessionProfile.sessionId
  const renderedParticipants = useMemo(() => {
    const bySessionId = new Map<
      string,
      {
        color: string
        displayName: string
        participantKey: string
        sessionId: string
        x: number
        y: number
      }
    >()

    for (const participant of roomParticipants) {
      bySessionId.set(participant.sessionId, {
        color: participant.color,
        displayName: participant.displayName,
        participantKey: participant.participantKey,
        sessionId: participant.sessionId,
        x: participant.cursorX * 100,
        y: participant.cursorY * 100,
      })
    }

    if (optimisticCursor) {
      bySessionId.set(optimisticCursor.sessionId, {
        ...optimisticCursor,
        x: optimisticCursor.x * 100,
        y: optimisticCursor.y * 100,
      })
    }

    return Array.from(bySessionId.values())
  }, [optimisticCursor, roomParticipants])

  useEffect(() => {
    setOptimisticCursor(null)
  }, [roomCode])

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <section className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Room {room.roomCode}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Owner: {room.ownerDisplayName} · {participantCount} active participant
            {participantCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{room.visibility}</Badge>
          <Badge variant={soundboardEnabled ? 'default' : 'secondary'}>
            Soundboard {soundboardEnabled ? 'On' : 'Off'}
          </Badge>
          <Button asChild size="sm" variant="outline">
            <a href={room.watchUrl} target="_blank" rel="noreferrer">
              Open Watch Link
            </a>
          </Button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>Shared Stage</CardTitle>
            <CardDescription>
              Cursor movement is streamed to everyone in this room. The preview is
              hover-only so tracking stays continuous across the whole stage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!participantRowsReady || !soundRowsReady ? (
              <p className="mb-3 text-sm text-muted-foreground">
                Syncing live room state...
              </p>
            ) : null}
            <div
              ref={cursorContainerRef}
              className="relative h-[420px] rounded-2xl border border-border/70 bg-muted/30"
              onMouseMove={onCursorMove}
              onMouseLeave={() => {
                lastCursorSentAt.current = 0
              }}
            >
              <div className="grid-overlay absolute inset-0 rounded-2xl" />
              <iframe
                className="pointer-events-none absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-xl border border-border/70 bg-background"
                src={watchFrameUrl ?? room.watchUrl}
                title={`Room ${room.roomCode} watch frame`}
              />

              {renderedParticipants.map((participant) => (
                <StageCursor
                  key={participant.participantKey}
                  color={participant.color}
                  displayName={participant.displayName}
                  isSelf={participant.sessionId === sessionProfile.sessionId}
                  x={participant.x}
                  y={participant.y}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Soundboard</CardTitle>
              <CardDescription>
                Allowed while participant count satisfies current room policy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {sounds.map((sound) => (
                  <Button
                    key={sound.id}
                    disabled={!soundboardEnabled || !hasJoined}
                    onClick={() => onSoundButtonClick(sound.id)}
                    type="button"
                    variant="secondary"
                  >
                    {sound.label}
                  </Button>
                ))}
              </div>

              {soundError ? (
                <p className="m-0 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {soundError}
                </p>
              ) : null}

              {joinError ? (
                <p className="m-0 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {joinError}
                </p>
              ) : null}

              <div className="space-y-2">
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent sounds
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {roomSoundEvents.slice(-6).map((event) => (
                    <p key={event.eventId} className="m-0">
                      {event.actorDisplayName} played {event.soundId}
                    </p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {isOwner ? (
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle>Owner Controls</CardTitle>
                <CardDescription>Override soundboard policy for this room.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
                  <div>
                    <p className="m-0 text-sm font-semibold">Manual mode</p>
                    <p className="m-0 text-xs text-muted-foreground">
                      Auto mode uses the default threshold.
                    </p>
                  </div>
                  <Switch
                    checked={effectiveOwnerPolicy?.kind === 'manual'}
                    onCheckedChange={(value) => {
                      if (!effectiveOwnerPolicy) {
                        return
                      }
                      if (value) {
                        if (effectiveOwnerPolicy.kind === 'manual') {
                          setOwnerDraftPolicy(effectiveOwnerPolicy)
                          return
                        }
                        setOwnerDraftPolicy({
                          kind: 'manual',
                          enabled: true,
                          maxParticipants: effectiveOwnerPolicy.defaultMaxParticipants,
                        })
                        return
                      }
                      if (effectiveOwnerPolicy.kind === 'auto') {
                        setOwnerDraftPolicy(effectiveOwnerPolicy)
                        return
                      }
                      setOwnerDraftPolicy({
                        kind: 'auto',
                        defaultMaxParticipants: effectiveOwnerPolicy.maxParticipants,
                      })
                    }}
                  />
                </div>

                {effectiveOwnerPolicy?.kind === 'manual' ? (
                  <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
                    <p className="m-0 text-sm font-semibold">Enabled</p>
                    <Switch
                      checked={effectiveOwnerPolicy.enabled}
                      onCheckedChange={(value) => {
                        if (effectiveOwnerPolicy.kind !== 'manual') {
                          return
                        }
                        setOwnerDraftPolicy({
                          ...effectiveOwnerPolicy,
                          enabled: value,
                        })
                      }}
                    />
                  </div>
                ) : null}

                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Max participants</span>
                    <span className="font-semibold">
                      {effectiveOwnerPolicy?.kind === 'manual'
                        ? effectiveOwnerPolicy.maxParticipants
                        : effectiveOwnerPolicy?.defaultMaxParticipants ?? 0}
                    </span>
                  </div>
                  <Slider
                    value={[
                      effectiveOwnerPolicy?.kind === 'manual'
                        ? effectiveOwnerPolicy.maxParticipants
                        : effectiveOwnerPolicy?.defaultMaxParticipants ?? 8,
                    ]}
                    min={2}
                    max={40}
                    step={1}
                    onValueChange={(value) => {
                      const capacity = value[0] ?? 8
                      if (!effectiveOwnerPolicy) {
                        return
                      }
                      if (effectiveOwnerPolicy.kind === 'manual') {
                        setOwnerDraftPolicy({
                          ...effectiveOwnerPolicy,
                          maxParticipants: capacity,
                        })
                        return
                      }
                      setOwnerDraftPolicy({
                        ...effectiveOwnerPolicy,
                        defaultMaxParticipants: capacity,
                      })
                    }}
                  />
                </div>

                <Button
                  disabled={!settingsDirty}
                  onClick={onSaveSoundboardSettings}
                  type="button"
                >
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  )
}
