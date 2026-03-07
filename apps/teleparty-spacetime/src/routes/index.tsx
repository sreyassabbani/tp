import { useNavigate } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'
import { customAlphabet } from 'nanoid'
import { useMemo, useState } from 'react'
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react'
import { tables, reducers } from '#/module_bindings'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import { Slider } from '#/components/ui/slider'
import { Switch } from '#/components/ui/switch'
import {
  DEFAULT_AUTO_SOUNDBOARD_CAPACITY,
  createRoomInputSchema,
  type SoundboardPolicy,
} from '#/lib/teleparty-domain'
import { useSessionProfile } from '#/lib/session'

export const Route = createFileRoute('/')({ component: RouteComponent })

const createRoomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)

function RouteComponent() {
  const navigate = useNavigate()
  const connectionState = useSpacetimeDB()
  const createRoom = useReducer(reducers.createRoom)

  const [rooms, roomsReady] = useTable(tables.room)
  const [participants, participantsReady] = useTable(tables.participant)

  const publicRooms = useMemo(() => {
    return [...rooms]
      .filter((room) => !room.archived && room.visibility === 'public')
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
  }, [rooms])

  const participantCountByRoom = useMemo(() => {
    const map = new Map<string, number>()
    for (const participant of participants) {
      map.set(participant.roomCode, (map.get(participant.roomCode) ?? 0) + 1)
    }
    return map
  }, [participants])

  const { sessionProfile, setSessionProfile, isHydrated } = useSessionProfile()

  const [watchUrl, setWatchUrl] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [accessCode, setAccessCode] = useState('')

  const [draftSoundboardPolicy, setDraftSoundboardPolicy] =
    useState<SoundboardPolicy>({
      kind: 'auto',
      defaultMaxParticipants: DEFAULT_AUTO_SOUNDBOARD_CAPACITY,
    })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const soundboardPreview = useMemo(() => {
    if (draftSoundboardPolicy.kind === 'manual') {
      return `${draftSoundboardPolicy.enabled ? 'Enabled' : 'Disabled'} up to ${draftSoundboardPolicy.maxParticipants} participants`
    }
    return `Auto mode: enabled up to ${draftSoundboardPolicy.defaultMaxParticipants} participants`
  }, [draftSoundboardPolicy])

  async function onCreateRoomSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (connectionState.connectionError) {
        throw connectionState.connectionError
      }

      if (!connectionState.isActive) {
        throw new Error('SpacetimeDB is still connecting. Retry in a moment.')
      }

      const parsed = createRoomInputSchema.parse({
        watchUrl,
        visibility: isPrivate
          ? {
              kind: 'private',
              accessCode,
            }
          : {
              kind: 'public',
            },
        soundboardPolicy: draftSoundboardPolicy,
      })

      const existingCodes = new Set(rooms.map((room) => room.roomCode))
      let roomCode = ''
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const candidate = createRoomCode()
        if (!existingCodes.has(candidate)) {
          roomCode = candidate
          break
        }
      }

      if (!roomCode) {
        throw new Error('Failed to generate unique room code. Retry.')
      }

      if (!isHydrated) {
        throw new Error('Session is still loading. Retry in a moment.')
      }

      await createRoom({
        roomCode,
        watchUrl: parsed.watchUrl,
        ownerSessionId: sessionProfile.sessionId,
        ownerDisplayName: sessionProfile.displayName,
        visibility: parsed.visibility.kind,
        accessCode: parsed.visibility.kind === 'private' ? parsed.visibility.accessCode : '',
        soundboardMode: parsed.soundboardPolicy.kind,
        soundboardEnabled:
          parsed.soundboardPolicy.kind === 'manual'
            ? parsed.soundboardPolicy.enabled
            : true,
        soundboardCapacity:
          parsed.soundboardPolicy.kind === 'manual'
            ? parsed.soundboardPolicy.maxParticipants
            : parsed.soundboardPolicy.defaultMaxParticipants,
      })

      await navigate({
        to: '/rooms/$roomCode',
        params: {
          roomCode,
        },
      })
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setError(unknownError.message)
      } else {
        setError('Failed to create room. Please retry.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function updateDisplayName(value: string) {
    setSessionProfile((current) =>
      ({
        ...current,
        displayName: value,
      }),
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <section className="grid-overlay relative overflow-hidden rounded-3xl border border-border/70 bg-card/75 p-6 shadow-lg shadow-primary/5 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 size-56 rounded-full bg-primary/18 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 size-52 rounded-full bg-amber-400/20 blur-3xl" />

        <Badge variant="outline" className="mb-3">
          SpacetimeDB Typed Tables + Reducers
        </Badge>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Create a room from any link.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Links do not need to be unique. Pick privacy, tune soundboard policy,
          then invite people to a shared cursor + soundboard room.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Create Room</CardTitle>
            <CardDescription>
              Parse-first room setup with explicit privacy and soundboard policy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={onCreateRoomSubmit}>
              <div className="space-y-2">
                <Label htmlFor="watch-url">Watch Link</Label>
                <Input
                  id="watch-url"
                  placeholder="https://example.com/watch?v=abc123"
                  value={watchUrl}
                  onChange={(event) => setWatchUrl(event.target.value)}
                />
              </div>

              <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="private-room" className="text-sm font-semibold">
                      Private Room
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Private rooms require an access code on join.
                    </p>
                  </div>
                  <Switch
                    id="private-room"
                    checked={isPrivate}
                    onCheckedChange={setIsPrivate}
                  />
                </div>

                {isPrivate ? (
                  <div className="space-y-2">
                    <Label htmlFor="access-code">Access Code</Label>
                    <Input
                      id="access-code"
                      placeholder="party-123"
                      value={accessCode}
                      onChange={(event) => setAccessCode(event.target.value)}
                    />
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="manual-policy" className="text-sm font-semibold">
                      Owner-Controlled Soundboard
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Auto mode enables sounds only while room size stays within
                      default capacity.
                    </p>
                  </div>
                  <Switch
                    id="manual-policy"
                    checked={draftSoundboardPolicy.kind === 'manual'}
                    onCheckedChange={(checked) => {
                      setDraftSoundboardPolicy((current) => {
                        if (checked) {
                          if (current.kind === 'manual') {
                            return current
                          }
                          return {
                            kind: 'manual',
                            enabled: true,
                            maxParticipants: DEFAULT_AUTO_SOUNDBOARD_CAPACITY,
                          }
                        }
                        return {
                          kind: 'auto',
                          defaultMaxParticipants: DEFAULT_AUTO_SOUNDBOARD_CAPACITY,
                        }
                      })
                    }}
                  />
                </div>

                {draftSoundboardPolicy.kind === 'manual' ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="manual-enabled"
                        checked={draftSoundboardPolicy.enabled}
                        onCheckedChange={(checked) => {
                          setDraftSoundboardPolicy((current) =>
                            current.kind === 'manual'
                              ? {
                                  ...current,
                                  enabled: Boolean(checked),
                                }
                              : current,
                          )
                        }}
                      />
                      <Label htmlFor="manual-enabled">Enable soundboard</Label>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Max participants</span>
                        <span>{draftSoundboardPolicy.maxParticipants}</span>
                      </div>
                      <Slider
                        value={[draftSoundboardPolicy.maxParticipants]}
                        min={2}
                        max={30}
                        step={1}
                        onValueChange={(values) => {
                          setDraftSoundboardPolicy((current) =>
                            current.kind === 'manual'
                              ? {
                                  ...current,
                                  maxParticipants: values[0] ?? current.maxParticipants,
                                }
                              : current,
                          )
                        }}
                      />
                    </div>
                  </>
                ) : null}

                <p className="text-xs font-medium text-muted-foreground">
                  {soundboardPreview}
                </p>
              </div>

              {error ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <Button
                disabled={isSubmitting || !isHydrated}
                className="w-full"
                type="submit"
              >
                {isSubmitting ? 'Creating room...' : 'Create Room'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Your Session</CardTitle>
            <CardDescription>
              Stored locally and used for ownership and cursor identity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={sessionProfile.displayName}
                onChange={(event) => updateDisplayName(event.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="m-0">
                Connection:{' '}
                {connectionState.connectionError
                  ? 'error'
                  : connectionState.isActive
                    ? 'active'
                    : 'connecting'}
              </p>
              {connectionState.connectionError ? (
                <p className="m-0 text-destructive">
                  {connectionState.connectionError.message}
                </p>
              ) : null}
              <p className="m-0">
                Session ID: <code>{sessionProfile.sessionId}</code>
              </p>
              <p className="m-0">
                Cursor color: <code>{sessionProfile.color}</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle>Public Rooms</CardTitle>
          <CardDescription>
            Link collisions are expected: each room is identified by room code, not
            by watch URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!roomsReady || !participantsReady ? (
            <p className="mb-4 text-sm text-muted-foreground">
              Syncing live room list...
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicRooms.map((room) => (
              <button
                key={room.roomCode}
                className="rounded-2xl border border-border/70 bg-background/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/50"
                onClick={() => {
                  navigate({
                    to: '/rooms/$roomCode',
                    params: { roomCode: room.roomCode },
                  })
                }}
                type="button"
              >
                <p className="m-0 text-xs text-muted-foreground">{room.watchHost}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  Room {room.roomCode}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {participantCountByRoom.get(room.roomCode) ?? 0} active
                  participant{(participantCountByRoom.get(room.roomCode) ?? 0) === 1 ? '' : 's'}
                </p>
              </button>
            ))}
          </div>

          {publicRooms.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">No public rooms yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
