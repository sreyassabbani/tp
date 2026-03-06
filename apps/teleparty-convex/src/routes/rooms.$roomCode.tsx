import usePresence from '@convex-dev/presence/react'
import { useMutation, useQuery } from 'convex/react'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
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
import { getRelativeCursorPosition } from '#/lib/cursor-stage'
import {
  canInteractWithStage,
  canUseSoundboard,
  getWatchFrameUrl,
  normalizeRoomCode,
  type StageInteractionPolicy,
  type SoundboardPolicy,
} from '#/lib/teleparty-domain'
import { loadSessionProfile } from '#/lib/session'
import { playSound, sounds } from '#/lib/soundboard'

export const Route = createFileRoute('/rooms/$roomCode')({
  component: RoomRoute,
})

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

function sameStageInteractionPolicy(
  left: StageInteractionPolicy,
  right: StageInteractionPolicy,
): boolean {
  return left.kind === right.kind
}

function RoomRoute() {
  const params = Route.useParams()
  const sessionProfile = useMemo(() => loadSessionProfile(), [])

  const [draftAccessCode, setDraftAccessCode] = useState('')
  const [submittedAccessCode, setSubmittedAccessCode] = useState<string | undefined>(
    undefined,
  )

  const [ownerDraftPolicy, setOwnerDraftPolicy] = useState<SoundboardPolicy | null>(
    null,
  )
  const [ownerDraftStagePolicy, setOwnerDraftStagePolicy] =
    useState<StageInteractionPolicy | null>(null)

  const [soundError, setSoundError] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [stageMode, setStageMode] = useState<'cursor' | 'interact'>('cursor')

  const roomCode = useMemo(() => {
    try {
      return normalizeRoomCode(params.roomCode)
    } catch {
      return null
    }
  }, [params.roomCode])

  const roomLookup = useQuery(
    api.rooms.getRoom,
    roomCode
      ? {
          roomCode,
          accessCode: submittedAccessCode,
        }
      : 'skip',
  )

  const cursors = useQuery(
    api.rooms.listCursors,
    roomCode
      ? {
          roomCode,
        }
      : 'skip',
  )

  const soundEvents = useQuery(
    api.rooms.listSoundEvents,
    roomCode
      ? {
          roomCode,
          limit: 40,
        }
      : 'skip',
  )

  const upsertCursor = useMutation(api.rooms.upsertCursor)
  const triggerSound = useMutation(api.rooms.triggerSound)
  const updateSoundboardPolicy = useMutation(api.rooms.updateSoundboardPolicy)
  const updateStageInteractionPolicy = useMutation(
    api.rooms.updateStageInteractionPolicy,
  )

  const presenceRoomId =
    roomCode && roomLookup?.kind === 'ok' ? roomCode : '__inactive_room__'

  const presenceState = usePresence(
    api.presence,
    presenceRoomId,
    sessionProfile.sessionId,
  )

  const onlineParticipantCount = useMemo(() => {
    if (!presenceState) {
      return roomLookup?.kind === 'ok' ? roomLookup.room.participantCount : 0
    }
    return presenceState.filter((presence) => presence.online).length
  }, [presenceState, roomLookup])

  const watchFrameUrl = useMemo(() => {
    if (roomLookup?.kind !== 'ok') {
      return null
    }
    return getWatchFrameUrl(roomLookup.room.watchUrl)
  }, [roomLookup])

  const roomPolicy = useMemo(() => {
    if (roomLookup?.kind !== 'ok') {
      return null
    }
    return roomLookup.room.soundboardPolicy
  }, [roomLookup])

  const roomStagePolicy = useMemo(() => {
    if (roomLookup?.kind !== 'ok') {
      return null
    }
    return roomLookup.room.stageInteractionPolicy
  }, [roomLookup])

  const roomPolicySignature = useMemo(() => {
    if (!roomPolicy) {
      return null
    }
    return JSON.stringify(roomPolicy)
  }, [roomPolicy])

  const roomStagePolicySignature = useMemo(() => {
    if (!roomStagePolicy) {
      return null
    }
    return JSON.stringify(roomStagePolicy)
  }, [roomStagePolicy])

  const lastSyncedPolicySignature = useRef<string | null>(null)
  const lastSyncedStagePolicySignature = useRef<string | null>(null)

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

  useEffect(() => {
    if (!roomStagePolicy || !roomStagePolicySignature) {
      lastSyncedStagePolicySignature.current = null
      setOwnerDraftStagePolicy(null)
      return
    }
    if (lastSyncedStagePolicySignature.current === roomStagePolicySignature) {
      return
    }
    lastSyncedStagePolicySignature.current = roomStagePolicySignature
    setOwnerDraftStagePolicy(roomStagePolicy)
  }, [roomCode, roomStagePolicy, roomStagePolicySignature])

  const effectiveOwnerPolicy = ownerDraftPolicy ?? roomPolicy
  const effectiveStagePolicy = ownerDraftStagePolicy ?? roomStagePolicy

  const soundboardSettingsDirty = useMemo(() => {
    if (!effectiveOwnerPolicy || !roomPolicy) {
      return false
    }
    return !sameSoundboardPolicy(effectiveOwnerPolicy, roomPolicy)
  }, [effectiveOwnerPolicy, roomPolicy])

  const stageSettingsDirty = useMemo(() => {
    if (!effectiveStagePolicy || !roomStagePolicy) {
      return false
    }
    return !sameStageInteractionPolicy(effectiveStagePolicy, roomStagePolicy)
  }, [effectiveStagePolicy, roomStagePolicy])

  const settingsDirty = soundboardSettingsDirty || stageSettingsDirty

  const seenSoundEvents = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const event of soundEvents ?? []) {
      if (seenSoundEvents.current.has(event.eventId)) {
        continue
      }
      seenSoundEvents.current.add(event.eventId)
      const sound = sounds.find((item) => item.id === event.soundId)
      if (sound) {
        playSound(sound.id)
      }
    }
  }, [soundEvents])

  const cursorContainerRef = useRef<HTMLDivElement | null>(null)
  const lastCursorUpdateAt = useRef(0)

  async function onCursorMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!roomCode || roomLookup?.kind !== 'ok') {
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

    const cursorPosition = getRelativeCursorPosition(
      area.getBoundingClientRect(),
      event,
    )
    if (!cursorPosition) {
      return
    }

    lastCursorUpdateAt.current = now

    await upsertCursor({
      roomCode,
      sessionId: sessionProfile.sessionId,
      displayName: sessionProfile.displayName,
      color: sessionProfile.color,
      x: cursorPosition.x,
      y: cursorPosition.y,
    })
  }

  async function onSoundButtonClick(soundId: (typeof sounds)[number]['id']) {
    if (!roomCode || roomLookup?.kind !== 'ok') {
      return
    }

    try {
      await triggerSound({
        roomCode,
        sessionId: sessionProfile.sessionId,
        displayName: sessionProfile.displayName,
        soundId,
      })
      setSoundError(null)
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setSoundError(unknownError.message)
      } else {
        setSoundError('Sound request failed.')
      }
    }
  }

  async function onSaveOwnerSettings() {
    if (
      !roomCode ||
      roomLookup?.kind !== 'ok' ||
      !effectiveOwnerPolicy ||
      !effectiveStagePolicy
    ) {
      return
    }

    try {
      if (soundboardSettingsDirty) {
        await updateSoundboardPolicy({
          roomCode,
          ownerSessionId: sessionProfile.sessionId,
          ownerSessionSecret: sessionProfile.sessionSecret,
          soundboardPolicy: effectiveOwnerPolicy,
        })
      }

      if (stageSettingsDirty) {
        await updateStageInteractionPolicy({
          roomCode,
          ownerSessionId: sessionProfile.sessionId,
          ownerSessionSecret: sessionProfile.sessionSecret,
          stageInteractionPolicy: effectiveStagePolicy,
        })
      }

      setOwnerDraftPolicy(null)
      setOwnerDraftStagePolicy(null)
      setSettingsError(null)
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setSettingsError(unknownError.message)
      } else {
        setSettingsError('Failed to save owner settings.')
      }
    }
  }

  const isOwner =
    roomLookup?.kind === 'ok' &&
    roomLookup.room.createdBySessionId === sessionProfile.sessionId
  const canUseStageInteraction =
    roomLookup?.kind === 'ok'
      ? canInteractWithStage(roomLookup.room.stageInteractionPolicy, isOwner)
      : false
  const stageIsInteractive = canUseStageInteraction && stageMode === 'interact'

  useEffect(() => {
    if (!canUseStageInteraction && stageMode === 'interact') {
      setStageMode('cursor')
    }
  }, [canUseStageInteraction, stageMode])

  useEffect(() => {
    lastCursorUpdateAt.current = 0
  }, [stageIsInteractive])

  const stageStatusMessage = stageIsInteractive
    ? 'Video controls are active. Shared cursor tracking pauses while you click inside the embed.'
    : canUseStageInteraction
      ? 'Cursor mode is active. Switch to video controls when you need to click play, pause, or scrub.'
      : 'Direct video controls are reserved for the room owner right now. Use Open Watch Link to interact in a new tab.'

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

  if (!roomLookup) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Loading room...</CardTitle>
          </CardHeader>
        </Card>
      </main>
    )
  }

  if (roomLookup.kind === 'not_found') {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Room not found</CardTitle>
            <CardDescription>
              The room may have expired due to inactivity.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  if (roomLookup.kind === 'forbidden') {
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
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                setSubmittedAccessCode(draftAccessCode)
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="access-code">Access code</Label>
                <Input
                  id="access-code"
                  value={draftAccessCode}
                  onChange={(event) => setDraftAccessCode(event.target.value)}
                />
              </div>
              <Button type="submit">Join Room</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    )
  }

  const room = roomLookup.room
  const soundboardEnabled = canUseSoundboard(
    room.soundboardPolicy,
    onlineParticipantCount,
  )

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <section className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Room {room.roomCode}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Owner: {room.createdByDisplayName} · {onlineParticipantCount} active
            participant{onlineParticipantCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{room.visibility.kind}</Badge>
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
            <CardDescription>{stageStatusMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {canUseStageInteraction ? (
                <Button
                  onClick={() =>
                    setStageMode((current) =>
                      current === 'interact' ? 'cursor' : 'interact',
                    )
                  }
                  size="sm"
                  type="button"
                  variant={stageIsInteractive ? 'default' : 'outline'}
                >
                  {stageIsInteractive ? 'Back To Cursor Mode' : 'Use Video Controls'}
                </Button>
              ) : (
                <Badge variant="secondary">Owner-only video controls</Badge>
              )}
              <p className="m-0 text-xs text-muted-foreground">
                {stageIsInteractive
                  ? 'Click inside the embed to start or control playback.'
                  : 'Cursor labels keep streaming while the room is in cursor mode.'}
              </p>
            </div>
            <div
              ref={cursorContainerRef}
              className="relative h-[420px] rounded-2xl border border-border/70 bg-muted/30"
              onMouseMove={stageIsInteractive ? undefined : onCursorMove}
              onMouseLeave={() => {
                lastCursorUpdateAt.current = 0
              }}
            >
              <div className="grid-overlay absolute inset-0 rounded-2xl" />
              <iframe
                className={`${stageIsInteractive ? '' : 'pointer-events-none '}absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-xl border border-border/70 bg-background`}
                src={watchFrameUrl ?? room.watchUrl}
                title={`Room ${room.roomCode} watch frame`}
              />

              {(cursors ?? []).map((cursor) => (
                <div
                  key={`${cursor.roomCode}-${cursor.sessionId}`}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${Math.round(cursor.x * 100)}%`,
                    top: `${Math.round(cursor.y * 100)}%`,
                  }}
                >
                  <div
                    className="rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow-md"
                    style={{ backgroundColor: cursor.color }}
                  >
                    {cursor.displayName}
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
                    disabled={!soundboardEnabled}
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

              <div className="space-y-2">
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent sounds
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {(soundEvents ?? []).slice(-6).map((event) => (
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
                <CardDescription>
                  Manage soundboard rules and who can take direct control of the
                  embedded video.
                </CardDescription>
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

                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
                  <div>
                    <p className="m-0 text-sm font-semibold">Guest video controls</p>
                    <p className="m-0 text-xs text-muted-foreground">
                      Allow non-owners to click play, pause, and scrub inside the
                      shared stage.
                    </p>
                  </div>
                  <Switch
                    checked={effectiveStagePolicy?.kind === 'everyone'}
                    onCheckedChange={(value) => {
                      setOwnerDraftStagePolicy({
                        kind: value ? 'everyone' : 'owner_only',
                      })
                    }}
                  />
                </div>

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
                  onClick={onSaveOwnerSettings}
                  type="button"
                >
                  Save Owner Settings
                </Button>

                {settingsError ? (
                  <p className="m-0 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {settingsError}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  )
}
