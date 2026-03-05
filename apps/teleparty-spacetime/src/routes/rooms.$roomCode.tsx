import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducer, useTable } from 'spacetimedb/react'
import { reducers, tables } from '#/module_bindings'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
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
import { getWatchFrameUrl, normalizeRoomCode } from '#/lib/teleparty-domain'
import { loadSessionProfile } from '#/lib/session'
import { playSound, sounds } from '#/lib/soundboard'

export const Route = createFileRoute('/rooms/$roomCode')({
  component: RoomRoute,
})

function RoomRoute() {
  const params = Route.useParams()
  const sessionProfile = useMemo(() => loadSessionProfile(), [])

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

  const [ownerManualMode, setOwnerManualMode] = useState(false)
  const [ownerEnabled, setOwnerEnabled] = useState(true)
  const [ownerCapacity, setOwnerCapacity] = useState(10)
  const [settingsDirty, setSettingsDirty] = useState(false)

  const [soundError, setSoundError] = useState<string | null>(null)

  const roomCode = useMemo(() => {
    try {
      return normalizeRoomCode(params.roomCode)
    } catch {
      return null
    }
  }, [params.roomCode])

  const [roomRows] = useTable(
    roomCode ? tables.room.where((room) => room.roomCode.eq(roomCode)) : tables.room,
  )

  const [participantRows] = useTable(
    roomCode
      ? tables.participant.where((participant) => participant.roomCode.eq(roomCode))
      : tables.participant,
  )

  const [soundRows] = useTable(
    roomCode
      ? tables.soundEvent.where((soundEvent) => soundEvent.roomCode.eq(roomCode))
      : tables.soundEvent,
  )

  const room = useMemo(() => {
    if (!roomCode) {
      return null
    }
    return roomRows.find((candidate) => candidate.roomCode === roomCode) ?? null
  }, [roomCode, roomRows])

  const roomParticipants = useMemo(() => {
    if (!roomCode) {
      return []
    }
    return participantRows.filter((participant) => participant.roomCode === roomCode)
  }, [participantRows, roomCode])

  const roomSoundEvents = useMemo(() => {
    if (!roomCode) {
      return []
    }
    return [...soundRows]
      .filter((soundEvent) => soundEvent.roomCode === roomCode)
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
  }, [roomCode, soundRows])

  const joiningRef = useRef(false)

  useEffect(() => {
    if (!room || hasJoined || joiningRef.current) {
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
      if (!roomCode || !hasJoined) {
        return
      }
      leaveRoom({ roomCode, sessionId: sessionProfile.sessionId }).catch(() => {
        // ignore on unmount
      })
    }
  }, [hasJoined, leaveRoom, roomCode, sessionProfile.sessionId])

  useEffect(() => {
    if (!room) {
      return
    }

    if (room.soundboardMode === 'manual') {
      setOwnerManualMode(true)
      setOwnerEnabled(room.manualSoundboardEnabled)
      setOwnerCapacity(room.manualSoundboardCapacity)
    } else {
      setOwnerManualMode(false)
      setOwnerEnabled(true)
      setOwnerCapacity(room.autoSoundboardCapacity)
    }
    setSettingsDirty(false)
  }, [room])

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
  const lastCursorUpdateAt = useRef(0)

  async function onCursorMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!roomCode || !room || !hasJoined) {
      return
    }

    const now = Date.now()
    if (now - lastCursorUpdateAt.current < 55) {
      return
    }

    const area = cursorContainerRef.current
    if (!area) {
      return
    }

    const rect = area.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height

    lastCursorUpdateAt.current = now

    await updateCursor({
      roomCode,
      sessionId: sessionProfile.sessionId,
      x,
      y,
    })
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
    if (!roomCode || !room) {
      return
    }

    await updateSoundboardPolicy({
      roomCode,
      ownerSessionId: sessionProfile.sessionId,
      mode: ownerManualMode ? 'manual' : 'auto',
      enabled: ownerEnabled,
      maxParticipants: ownerCapacity,
    })

    setSettingsDirty(false)
  }

  async function onPrivateRoomSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!roomCode || !room) {
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
  const soundboardEnabled =
    room.soundboardMode === 'manual'
      ? room.manualSoundboardEnabled && participantCount <= room.manualSoundboardCapacity
      : participantCount <= room.autoSoundboardCapacity

  const isOwner = room.ownerSessionId === sessionProfile.sessionId
  const watchFrameUrl = useMemo(() => getWatchFrameUrl(room.watchUrl), [room.watchUrl])

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
              Cursor movement is streamed to everyone in this room.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              ref={cursorContainerRef}
              className="relative h-[420px] rounded-2xl border border-border/70 bg-muted/30"
              onMouseMove={onCursorMove}
              onMouseLeave={() => {
                lastCursorUpdateAt.current = 0
              }}
            >
              <div className="grid-overlay absolute inset-0 rounded-2xl" />
              <iframe
                className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-xl border border-border/70 bg-background"
                src={watchFrameUrl}
                title={`Room ${room.roomCode} watch frame`}
              />

              {roomParticipants.map((participant) => (
                <div
                  key={participant.participantKey}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${Math.round(participant.cursorX * 100)}%`,
                    top: `${Math.round(participant.cursorY * 100)}%`,
                  }}
                >
                  <div
                    className="rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow-md"
                    style={{ backgroundColor: participant.color }}
                  >
                    {participant.displayName}
                  </div>
                </div>
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
                    checked={ownerManualMode}
                    onCheckedChange={(value) => {
                      setOwnerManualMode(value)
                      setSettingsDirty(true)
                    }}
                  />
                </div>

                {ownerManualMode ? (
                  <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
                    <p className="m-0 text-sm font-semibold">Enabled</p>
                    <Switch
                      checked={ownerEnabled}
                      onCheckedChange={(value) => {
                        setOwnerEnabled(value)
                        setSettingsDirty(true)
                      }}
                    />
                  </div>
                ) : null}

                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Max participants</span>
                    <span className="font-semibold">{ownerCapacity}</span>
                  </div>
                  <Slider
                    value={[ownerCapacity]}
                    min={2}
                    max={40}
                    step={1}
                    onValueChange={(value) => {
                      setOwnerCapacity(value[0] ?? 8)
                      setSettingsDirty(true)
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
