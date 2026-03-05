import { useMutation, useQuery } from 'convex/react'
import { useNavigate } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
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
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import { Slider } from '#/components/ui/slider'
import { Switch } from '#/components/ui/switch'
import {
  DEFAULT_AUTO_SOUNDBOARD_CAPACITY,
  createRoomInputSchema,
} from '#/lib/teleparty-domain'
import {
  loadSessionProfile,
  saveSessionProfile,
  type SessionProfile,
} from '#/lib/session'

export const Route = createFileRoute('/')({ component: RouteComponent })

function RouteComponent() {
  const navigate = useNavigate()
  const createRoom = useMutation(api.rooms.createRoom)
  const publicRooms = useQuery(api.rooms.listPublicRooms, { limit: 12 })
  const roomPolicy = useQuery(api.rooms.defaultRoomPolicy, {})

  const [sessionProfile, setSessionProfile] = useState<SessionProfile>(() =>
    loadSessionProfile(),
  )

  const [watchUrl, setWatchUrl] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [accessCode, setAccessCode] = useState('')

  const [manualSoundboardPolicy, setManualSoundboardPolicy] = useState(false)
  const [manualSoundboardEnabled, setManualSoundboardEnabled] = useState(true)
  const [manualCapacity, setManualCapacity] = useState(10)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const autoCapacity =
    roomPolicy?.soundboardPolicy.defaultMaxParticipants ??
    DEFAULT_AUTO_SOUNDBOARD_CAPACITY

  const soundboardPreview = useMemo(() => {
    if (manualSoundboardPolicy) {
      return `${manualSoundboardEnabled ? 'Enabled' : 'Disabled'} up to ${manualCapacity} participants`
    }
    return `Auto mode: enabled up to ${autoCapacity} participants`
  }, [autoCapacity, manualCapacity, manualSoundboardEnabled, manualSoundboardPolicy])

  async function onCreateRoomSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
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
        soundboardPolicy: manualSoundboardPolicy
          ? {
              kind: 'manual',
              enabled: manualSoundboardEnabled,
              maxParticipants: manualCapacity,
            }
          : {
              kind: 'auto',
              defaultMaxParticipants: autoCapacity,
            },
      })

      const created = await createRoom({
        watchUrl: parsed.watchUrl,
        ownerSessionId: sessionProfile.sessionId,
        ownerDisplayName: sessionProfile.displayName,
        visibility: parsed.visibility,
        soundboardPolicy: parsed.soundboardPolicy,
      })

      await navigate({
        to: '/rooms/$roomCode',
        params: {
          roomCode: created.roomCode,
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

  function updateDisplayName(value: string): void {
    setSessionProfile((current) =>
      saveSessionProfile({
        ...current,
        displayName: value,
      }),
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <section className="grid-overlay relative overflow-hidden rounded-3xl border border-border/70 bg-card/75 p-6 shadow-lg shadow-primary/5 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 size-56 rounded-full bg-primary/18 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 size-52 rounded-full bg-orange-400/20 blur-3xl" />

        <Badge variant="outline" className="mb-3">
          Convex Components: Presence + Rate Limiter + Workflow
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
                    checked={manualSoundboardPolicy}
                    onCheckedChange={setManualSoundboardPolicy}
                  />
                </div>

                {manualSoundboardPolicy ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="manual-enabled"
                        checked={manualSoundboardEnabled}
                        onCheckedChange={(checked) =>
                          setManualSoundboardEnabled(Boolean(checked))
                        }
                      />
                      <Label htmlFor="manual-enabled">Enable soundboard</Label>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Max participants</span>
                        <span>{manualCapacity}</span>
                      </div>
                      <Slider
                        value={[manualCapacity]}
                        min={2}
                        max={30}
                        step={1}
                        onValueChange={(values) => setManualCapacity(values[0] ?? 10)}
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

              <Button disabled={isSubmitting} className="w-full" type="submit">
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(publicRooms ?? []).map((room) => (
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
                  {room.participantCount} active participant
                  {room.participantCount === 1 ? '' : 's'}
                </p>
              </button>
            ))}
          </div>

          {(publicRooms ?? []).length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">No public rooms yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
