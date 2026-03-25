<script lang="ts">
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import OwnerPanel from '$lib/components/room/OwnerPanel.svelte';
	import PrivateRoomGate from '$lib/components/room/PrivateRoomGate.svelte';
	import RoomHeading from '$lib/components/room/RoomHeading.svelte';
	import RoomStatePanel from '$lib/components/room/RoomStatePanel.svelte';
	import SoundboardPanel from '$lib/components/room/SoundboardPanel.svelte';
	import StagePanel from '$lib/components/room/StagePanel.svelte';
	import SessionCard from '$lib/components/shared/SessionCard.svelte';
	import { api } from '$lib/convex-api';
	import { startPresenceSession } from '$lib/convex-presence';
	import {
		canInteractWithStage,
		canUseSoundboard,
		getWatchFrameUrl,
		normalizeRoomCode,
		type RoomCapability
	} from '$lib/teleparty-domain';
	import { sessionProfile, sessionReady, updateSessionProfile } from '$lib/session';
	import { playSound, sounds } from '$lib/soundboard';
	import type {
		CursorViewModel,
		OwnerSettingsDraft,
		RoomLookupResult,
		RoomViewModel,
		SoundEventViewModel
	} from '$lib/view-models';

	const client = useConvexClient();
	const CURSOR_SEND_INTERVAL_MS = 40;
	const PUBLIC_CONVEX_URL = env.PUBLIC_CONVEX_URL ?? '';

	let submittedAccessCode = $state<string | undefined>(undefined);
	let soundError = $state<string | null>(null);
	let settingsError = $state<string | null>(null);
	let participantAccessError = $state<string | null>(null);
	let updatingParticipantSessionId = $state<string | null>(null);
	let stageMode = $state<'cursor' | 'interact'>('cursor');
	let optimisticCursor = $state<CursorViewModel | null>(null);

	let lastCursorSentAt = 0;
	let cursorFlushTimeout: number | null = null;
	let cursorMutationInFlight = false;
	let pendingCursorPayload:
		| {
				roomCode: string;
				sessionId: string;
				displayName: string;
				color: string;
				x: number;
				y: number;
		  }
		| null = null;
	let seenSoundEvents = new Set<string>();

	let roomCode = $derived.by(() => {
		const rawRoomCode = page.params.roomCode;
		if (!rawRoomCode) {
			return null;
		}

		try {
			return normalizeRoomCode(rawRoomCode);
		} catch {
			return null;
		}
	});

	const roomLookupQuery = useQuery(api.rooms.getRoom, () =>
		roomCode
			? {
					roomCode,
					accessCode: submittedAccessCode
				}
			: 'skip'
	);

	const cursorsQuery = useQuery(api.rooms.listCursors, () =>
		roomCode
			? {
					roomCode
				}
			: 'skip'
	);

	const soundEventsQuery = useQuery(api.rooms.listSoundEvents, () =>
		roomCode
			? {
					roomCode,
					limit: 40
				}
			: 'skip'
	);

	let roomLookup = $derived(roomLookupQuery.data as RoomLookupResult | undefined);
	let liveCursors = $derived((cursorsQuery.data ?? []) as CursorViewModel[]);
	let soundEvents = $derived((soundEventsQuery.data ?? []) as SoundEventViewModel[]);
	let room = $derived.by<RoomViewModel | null>(() =>
		roomLookup?.kind === 'ok' ? roomLookup.room : null
	);
	let watchFrameUrl = $derived(room ? getWatchFrameUrl(room.watchUrl) : null);
	let isOwner = $derived(Boolean(room && room.createdBySessionId === $sessionProfile.sessionId));
	let selfParticipant = $derived(
		room?.participants.find((participant) => participant.sessionId === $sessionProfile.sessionId) ??
			null
	);
	let selfCapabilities = $derived(selfParticipant?.capabilities ?? []);
	let canUseStageInteraction = $derived(
		room
			? canInteractWithStage(room.stageInteractionPolicy, isOwner, selfCapabilities)
			: false
	);
	let onlineParticipantCount = $derived(room?.participantCount ?? 0);
	let soundboardEnabled = $derived(
		room ? canUseSoundboard(room.soundboardPolicy, onlineParticipantCount) : false
	);
	let stageIsInteractive = $derived(canUseStageInteraction && stageMode === 'interact');
	let stageStatusMessage = $derived.by(() =>
		stageIsInteractive
			? 'Video controls are active. Shared cursor tracking pauses while you click inside the embed.'
			: canUseStageInteraction
				? 'Cursor mode is active. Switch to video controls when you need to click play, pause, or scrub.'
				: 'This browser does not currently have direct video control. Ask the room owner for access or use Open Watch Link in a new tab.'
	);

	let renderedCursors = $derived.by<CursorViewModel[]>(() => {
		const bySessionId = new Map<string, CursorViewModel>();

		for (const cursor of liveCursors) {
			bySessionId.set(cursor.sessionId, {
				color: cursor.color,
				displayName: cursor.displayName,
				sessionId: cursor.sessionId,
				x: cursor.x * 100,
				y: cursor.y * 100
			});
		}

		if (optimisticCursor) {
			bySessionId.set(optimisticCursor.sessionId, {
				...optimisticCursor,
				x: optimisticCursor.x * 100,
				y: optimisticCursor.y * 100
			});
		}

		return Array.from(bySessionId.values());
	});

	$effect(() => {
		if (!canUseStageInteraction && stageMode === 'interact') {
			stageMode = 'cursor';
		}
	});

	$effect(() => {
		roomCode;
		submittedAccessCode = undefined;
		stageMode = 'cursor';
		soundError = null;
		settingsError = null;
		participantAccessError = null;
		optimisticCursor = null;
		lastCursorSentAt = 0;
		pendingCursorPayload = null;
		seenSoundEvents = new Set();

		if (cursorFlushTimeout !== null) {
			window.clearTimeout(cursorFlushTimeout);
			cursorFlushTimeout = null;
		}
	});

	$effect(() => {
		for (const event of soundEvents) {
			if (seenSoundEvents.has(event.eventId)) {
				continue;
			}

			seenSoundEvents.add(event.eventId);
			const sound = sounds.find((candidate) => candidate.id === event.soundId);
			if (sound) {
				playSound(sound.id);
			}
		}
	});

	$effect(() => {
		if (!browser || !$sessionReady || !roomCode || roomLookup?.kind !== 'ok') {
			return;
		}

		return startPresenceSession({
			baseUrl: PUBLIC_CONVEX_URL,
			client,
			roomId: roomCode,
			userId: $sessionProfile.sessionId
		});
	});

	$effect(() => {
		if (!browser || !$sessionReady || !roomCode || roomLookup?.kind !== 'ok') {
			return;
		}

		const sync = async () => {
			try {
				await client.mutation(api.rooms.upsertParticipantProfile, {
					roomCode,
					sessionId: $sessionProfile.sessionId,
					displayName: $sessionProfile.displayName,
					color: $sessionProfile.color
				});
			} catch {
				// Ignore transient sync failures; subsequent presence heartbeats retry.
			}
		};

		void sync();
		const intervalId = window.setInterval(() => {
			void sync();
		}, 12_000);

		return () => {
			window.clearInterval(intervalId);
		};
	});

	$effect(() => {
		return () => {
			if (cursorFlushTimeout !== null) {
				window.clearTimeout(cursorFlushTimeout);
			}
		};
	});

	function updateDisplayName(value: string) {
		if (!$sessionReady) {
			return;
		}

		updateSessionProfile((current) => ({
			...current,
			displayName: value
		}));
	}

	function scheduleCursorFlush(delayMs: number) {
		if (cursorFlushTimeout !== null) {
			return;
		}

		cursorFlushTimeout = window.setTimeout(() => {
			cursorFlushTimeout = null;
			void flushCursorUpdate();
		}, delayMs);
	}

	async function flushCursorUpdate() {
		if (cursorMutationInFlight) {
			return;
		}

		const payload = pendingCursorPayload;
		if (!payload) {
			return;
		}

		const elapsed = Date.now() - lastCursorSentAt;
		if (elapsed < CURSOR_SEND_INTERVAL_MS) {
			scheduleCursorFlush(CURSOR_SEND_INTERVAL_MS - elapsed);
			return;
		}

		pendingCursorPayload = null;
		cursorMutationInFlight = true;
		lastCursorSentAt = Date.now();

		try {
			await client.mutation(api.rooms.upsertCursor, payload);
		} catch {
			// Ignore transient cursor sync failures; the next move retries with latest state.
		} finally {
			cursorMutationInFlight = false;
			if (pendingCursorPayload) {
				void flushCursorUpdate();
			}
		}
	}

	function onPointerLeave() {
		lastCursorSentAt = 0;
		optimisticCursor = null;
		pendingCursorPayload = null;
	}

	function onCursorMove(position: { x: number; y: number }) {
		if (!roomCode || !room || stageIsInteractive) {
			return;
		}

		const payload = {
			roomCode,
			sessionId: $sessionProfile.sessionId,
			displayName: $sessionProfile.displayName,
			color: $sessionProfile.color,
			x: position.x,
			y: position.y
		};

		optimisticCursor = {
			color: payload.color,
			displayName: payload.displayName,
			sessionId: payload.sessionId,
			x: payload.x,
			y: payload.y
		};

		pendingCursorPayload = payload;
		void flushCursorUpdate();
	}

	async function onSoundButtonClick(soundId: (typeof sounds)[number]['id']) {
		if (!roomCode || !room) {
			return;
		}

		try {
			await client.mutation(api.rooms.triggerSound, {
				roomCode,
				sessionId: $sessionProfile.sessionId,
				displayName: $sessionProfile.displayName,
				color: $sessionProfile.color,
				soundId
			});
			soundError = null;
		} catch (unknownError) {
			soundError =
				unknownError instanceof Error ? unknownError.message : 'Sound request failed.';
		}
	}

	async function onToggleParticipantStageControl(participant: {
		capabilities: RoomCapability[];
		sessionId: string;
	}) {
		if (!roomCode || !room) {
			return;
		}

		const hasStageControl = participant.capabilities.includes('stage_control');
		const nextCapabilities = hasStageControl
			? participant.capabilities.filter((capability) => capability !== 'stage_control')
			: [...participant.capabilities, 'stage_control'];

		try {
			updatingParticipantSessionId = participant.sessionId;
			await client.mutation(api.rooms.setParticipantCapabilities, {
				roomCode,
				ownerSessionId: $sessionProfile.sessionId,
				ownerSessionSecret: $sessionProfile.sessionSecret,
				participantSessionId: participant.sessionId,
				capabilities: nextCapabilities
			});
			participantAccessError = null;
		} catch (unknownError) {
			participantAccessError =
				unknownError instanceof Error
					? unknownError.message
					: 'Failed to update participant access.';
		} finally {
			updatingParticipantSessionId = null;
		}
	}

	async function saveOwnerSettings(draft: OwnerSettingsDraft) {
		if (!roomCode || !room) {
			return;
		}

		try {
			if (draft.soundboardDirty) {
				await client.mutation(api.rooms.updateSoundboardPolicy, {
					roomCode,
					ownerSessionId: $sessionProfile.sessionId,
					ownerSessionSecret: $sessionProfile.sessionSecret,
					soundboardPolicy: draft.soundboardPolicy
				});
			}

			if (draft.stageDirty) {
				await client.mutation(api.rooms.updateStageInteractionPolicy, {
					roomCode,
					ownerSessionId: $sessionProfile.sessionId,
					ownerSessionSecret: $sessionProfile.sessionSecret,
					stageInteractionPolicy: draft.stageInteractionPolicy
				});
			}

			settingsError = null;
		} catch (unknownError) {
			settingsError =
				unknownError instanceof Error
					? unknownError.message
					: 'Failed to save owner settings.';
		}
	}

	function onPrivateJoin(accessCode: string) {
		submittedAccessCode = accessCode;
	}

	function onStageModeChange(nextMode: 'cursor' | 'interact') {
		stageMode = nextMode;
		if (nextMode === 'interact') {
			optimisticCursor = null;
		}
	}
</script>

<svelte:head>
	<title>{roomCode ? `Room ${roomCode} / Teleparty Studio` : 'Room / Teleparty Studio'}</title>
</svelte:head>

{#if !roomCode}
	<RoomStatePanel
		body="Room codes use six characters from A-Z without I/O and digits 2-9."
		eyebrow="Invalid room code"
		title="That room code does not exist in this cut."
	/>
{:else if roomLookupQuery.error}
	<RoomStatePanel
		body={roomLookupQuery.error.message}
		eyebrow="Connection error"
		title="The Convex room query failed."
	/>
{:else if roomLookupQuery.isLoading}
	<RoomStatePanel
		body="Waiting for the live Convex subscription to settle."
		eyebrow="Loading"
		title="Opening the screening room..."
	/>
{:else if roomLookup?.kind === 'not_found'}
	<RoomStatePanel
		actionLabel="Back to lobby"
		body="The room may have expired due to inactivity."
		eyebrow="Missing room"
		onAction={() => goto('/')}
		title={`Nothing active is stored under ${roomCode}.`}
	/>
{:else if roomLookup?.kind === 'forbidden'}
	<PrivateRoomGate {roomCode} onJoin={onPrivateJoin} />
{:else if room}
	<main class="shell room-shell">
		<RoomHeading {onlineParticipantCount} {room} {soundboardEnabled} />

		<section class="room-layout">
			<div class="room-stage-column">
				<StagePanel
					{canUseStageInteraction}
					cursors={renderedCursors}
					onCursorMove={onCursorMove}
					onPointerLeave={onPointerLeave}
					onStageModeChange={onStageModeChange}
					roomCode={room.roomCode}
					selfSessionId={$sessionProfile.sessionId}
					{stageIsInteractive}
					{stageMode}
					{stageStatusMessage}
					watchFrameUrl={watchFrameUrl ?? room.watchUrl}
				/>
			</div>

			<aside class="room-rail">
				<SoundboardPanel
					error={soundError}
					events={soundEvents}
					onTrigger={onSoundButtonClick}
					{soundboardEnabled}
				/>

				<SessionCard
					eyebrow="Presence"
					profile={$sessionProfile}
					subtitle="This identity stays with you through the room so the stage, soundboard, and participant list all agree on who you are."
					title="Your session"
					updateDisplayName={updateDisplayName}
				/>
			</aside>

			{#if isOwner}
				<div class="room-owner-span">
					<OwnerPanel
						onSave={saveOwnerSettings}
						onToggleParticipantStageControl={onToggleParticipantStageControl}
						ownerSessionId={room.createdBySessionId}
						{participantAccessError}
						participants={room.participants}
						{settingsError}
						soundboardPolicy={room.soundboardPolicy}
						stageInteractionPolicy={room.stageInteractionPolicy}
						{updatingParticipantSessionId}
					/>
				</div>
			{/if}
		</section>
	</main>
{/if}
