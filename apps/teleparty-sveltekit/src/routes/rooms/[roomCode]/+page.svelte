<svelte:options runes={false} />

<script lang="ts">
	import { browser } from '$app/environment';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import { quintOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import StageCursor from '$lib/components/StageCursor.svelte';
	import { api } from '$lib/convex-api';
	import { startPresenceSession } from '$lib/convex-presence';
	import { getRelativeCursorPosition } from '$lib/cursor-stage';
	import {
		canInteractWithStage,
		canUseSoundboard,
		getWatchFrameUrl,
		normalizeRoomCode,
		type RoomCapability,
		type SoundboardPolicy,
		type StageInteractionPolicy
	} from '$lib/teleparty-domain';
	import {
		hydrateSessionProfile,
		sessionProfile,
		sessionReady,
		updateSessionProfile
	} from '$lib/session';
	import { playSound, sounds } from '$lib/soundboard';

	const client = useConvexClient();
	const CURSOR_SEND_INTERVAL_MS = 40;

	let draftAccessCode = '';
	let submittedAccessCode: string | undefined = undefined;
	let hasAttemptedJoin = false;

	let ownerDraftPolicy: SoundboardPolicy | null = null;
	let ownerDraftStagePolicy: StageInteractionPolicy | null = null;

	let soundError: string | null = null;
	let settingsError: string | null = null;
	let participantAccessError: string | null = null;
	let updatingParticipantSessionId: string | null = null;
	let stageMode: 'cursor' | 'interact' = 'cursor';
	let optimisticCursor:
		| {
				color: string;
				displayName: string;
				sessionId: string;
				x: number;
				y: number;
		  }
		| null = null;

	let cursorContainer: HTMLDivElement | null = null;
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

	let lastSyncedPolicySignature: string | null = null;
	let lastSyncedStagePolicySignature: string | null = null;
	let seenSoundEvents = new Set<string>();
	let lastSeenRoomCode: string | null = null;

	let activePresenceKey: string | null = null;
	let stopPresenceSession: (() => void) | null = null;
	let participantSyncKey: string | null = null;
	let participantSyncInterval: number | null = null;
	let previousRoomCode: string | null = null;

	$: roomCode = (() => {
		const rawRoomCode = $page.params.roomCode;
		if (!rawRoomCode) {
			return null;
		}

		try {
			return normalizeRoomCode(rawRoomCode);
		} catch {
			return null;
		}
	})();

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

	$: roomLookup = roomLookupQuery.data;
	$: liveCursors = cursorsQuery.data ?? [];
	$: soundEvents = soundEventsQuery.data ?? [];
	$: room =
		roomLookup?.kind === 'ok'
			? roomLookup.room
			: null;
	$: watchFrameUrl = room ? getWatchFrameUrl(room.watchUrl) : null;
	$: roomPolicy = room?.soundboardPolicy ?? null;
	$: roomStagePolicy = room?.stageInteractionPolicy ?? null;
	$: roomPolicySignature = roomPolicy ? JSON.stringify(roomPolicy) : null;
	$: roomStagePolicySignature = roomStagePolicy
		? JSON.stringify(roomStagePolicy)
		: null;

	$: if (!roomPolicySignature) {
		lastSyncedPolicySignature = null;
		ownerDraftPolicy = null;
	} else if (lastSyncedPolicySignature !== roomPolicySignature) {
		lastSyncedPolicySignature = roomPolicySignature;
		ownerDraftPolicy = roomPolicy;
	}

	$: if (!roomStagePolicySignature) {
		lastSyncedStagePolicySignature = null;
		ownerDraftStagePolicy = null;
	} else if (lastSyncedStagePolicySignature !== roomStagePolicySignature) {
		lastSyncedStagePolicySignature = roomStagePolicySignature;
		ownerDraftStagePolicy = roomStagePolicy;
	}

	$: effectiveOwnerPolicy = ownerDraftPolicy ?? roomPolicy;
	$: effectiveStagePolicy = ownerDraftStagePolicy ?? roomStagePolicy;
	$: soundboardSettingsDirty =
		Boolean(effectiveOwnerPolicy && roomPolicy) &&
		JSON.stringify(effectiveOwnerPolicy) !== JSON.stringify(roomPolicy);
	$: stageSettingsDirty =
		Boolean(effectiveStagePolicy && roomStagePolicy) &&
		JSON.stringify(effectiveStagePolicy) !== JSON.stringify(roomStagePolicy);
	$: settingsDirty = soundboardSettingsDirty || stageSettingsDirty;
	$: isOwner = Boolean(room && room.createdBySessionId === $sessionProfile.sessionId);
	$: selfParticipant =
		room?.participants.find((participant) => participant.sessionId === $sessionProfile.sessionId) ??
		null;
	$: selfCapabilities = selfParticipant?.capabilities ?? [];
	$: canUseStageInteraction = room
		? canInteractWithStage(room.stageInteractionPolicy, isOwner, selfCapabilities)
		: false;
	$: if (!canUseStageInteraction && stageMode === 'interact') {
		stageMode = 'cursor';
	}

	$: onlineParticipantCount = room?.participantCount ?? 0;
	$: soundboardEnabled = room
		? canUseSoundboard(room.soundboardPolicy, onlineParticipantCount)
		: false;
	$: stageIsInteractive = canUseStageInteraction && stageMode === 'interact';
	$: stageStatusMessage = stageIsInteractive
		? 'Video controls are active. Shared cursor tracking pauses while you click inside the embed.'
		: canUseStageInteraction
			? 'Cursor mode is active. Switch to video controls when you need to click play, pause, or scrub.'
			: 'This browser does not currently have direct video control. Ask the room owner for access or use Open Watch Link in a new tab.';

	$: manageableParticipants = room
		? [...room.participants]
				.filter((participant) => participant.sessionId !== room.createdBySessionId)
				.sort((left, right) => {
					if (left.online !== right.online) {
						return left.online ? -1 : 1;
					}
					return left.displayName.localeCompare(right.displayName);
				})
		: [];

	$: renderedCursors = (() => {
		const bySessionId = new Map<
			string,
			{
				color: string;
				displayName: string;
				sessionId: string;
				x: number;
				y: number;
			}
		>();

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
	})();

	$: if (roomCode !== previousRoomCode) {
		previousRoomCode = roomCode;
		optimisticCursor = null;
		lastCursorSentAt = 0;
	}

	$: if (roomCode !== lastSeenRoomCode) {
		lastSeenRoomCode = roomCode;
		seenSoundEvents = new Set();
	}

	$: for (const event of soundEvents) {
		if (seenSoundEvents.has(event.eventId)) {
			continue;
		}

		seenSoundEvents.add(event.eventId);
		const sound = sounds.find((candidate) => candidate.id === event.soundId);
		if (sound) {
			playSound(sound.id);
		}
	}

	$: {
		const nextPresenceKey =
			browser && $sessionReady && roomCode && roomLookup?.kind === 'ok'
				? `${roomCode}:${$sessionProfile.sessionId}`
				: null;

		if (nextPresenceKey !== activePresenceKey) {
			stopPresenceSession?.();
			stopPresenceSession = null;
			activePresenceKey = nextPresenceKey;

			if (nextPresenceKey && roomCode) {
				stopPresenceSession = startPresenceSession({
					baseUrl: PUBLIC_CONVEX_URL,
					client,
					roomId: roomCode,
					userId: $sessionProfile.sessionId
				});
			}
		}
	}

	$: {
		const nextParticipantSyncKey =
			browser && $sessionReady && roomCode && roomLookup?.kind === 'ok'
				? `${roomCode}:${$sessionProfile.sessionId}:${$sessionProfile.displayName}:${$sessionProfile.color}`
				: null;

		if (nextParticipantSyncKey !== participantSyncKey) {
			if (participantSyncInterval !== null) {
				window.clearInterval(participantSyncInterval);
				participantSyncInterval = null;
			}

			participantSyncKey = nextParticipantSyncKey;

			if (nextParticipantSyncKey && roomCode) {
				const activeRoomCode = roomCode;
				const syncParticipantProfile = async () => {
					try {
						await client.mutation(api.rooms.upsertParticipantProfile, {
							roomCode: activeRoomCode,
							sessionId: $sessionProfile.sessionId,
							displayName: $sessionProfile.displayName,
							color: $sessionProfile.color
						});
					} catch {
						// Ignore transient heartbeat errors; the next sync retries.
					}
				};

				void syncParticipantProfile();
				participantSyncInterval = window.setInterval(syncParticipantProfile, 20_000);
			}
		}
	}

	onMount(() => {
		hydrateSessionProfile();
	});

	onDestroy(() => {
		stopPresenceSession?.();

		if (participantSyncInterval !== null) {
			window.clearInterval(participantSyncInterval);
		}

		if (cursorFlushTimeout !== null) {
			window.clearTimeout(cursorFlushTimeout);
		}
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
	}

	function onCursorMove(event: PointerEvent) {
		if (!roomCode || !room || stageIsInteractive || !cursorContainer) {
			return;
		}

		const cursorPosition = getRelativeCursorPosition(
			cursorContainer.getBoundingClientRect(),
			event
		);
		if (!cursorPosition) {
			return;
		}

		const payload = {
			roomCode,
			sessionId: $sessionProfile.sessionId,
			displayName: $sessionProfile.displayName,
			color: $sessionProfile.color,
			x: cursorPosition.x,
			y: cursorPosition.y
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
				unknownError instanceof Error
					? unknownError.message
					: 'Sound request failed.';
		}
	}

	async function onToggleParticipantStageControl(participant: {
		sessionId: string;
		capabilities: RoomCapability[];
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

	async function onSaveOwnerSettings() {
		if (!roomCode || !room || !effectiveOwnerPolicy || !effectiveStagePolicy) {
			return;
		}

		try {
			if (soundboardSettingsDirty) {
				await client.mutation(api.rooms.updateSoundboardPolicy, {
					roomCode,
					ownerSessionId: $sessionProfile.sessionId,
					ownerSessionSecret: $sessionProfile.sessionSecret,
					soundboardPolicy: effectiveOwnerPolicy
				});
			}

			if (stageSettingsDirty) {
				await client.mutation(api.rooms.updateStageInteractionPolicy, {
					roomCode,
					ownerSessionId: $sessionProfile.sessionId,
					ownerSessionSecret: $sessionProfile.sessionSecret,
					stageInteractionPolicy: effectiveStagePolicy
				});
			}

			ownerDraftPolicy = null;
			ownerDraftStagePolicy = null;
			settingsError = null;
		} catch (unknownError) {
			settingsError =
				unknownError instanceof Error
					? unknownError.message
					: 'Failed to save owner settings.';
		}
	}

	function onPrivateJoin() {
		hasAttemptedJoin = true;
		submittedAccessCode = draftAccessCode;
	}
</script>

<svelte:head>
	<title>{roomCode ? `Room ${roomCode} / SvelteKit + Convex` : 'Room / SvelteKit + Convex'}</title>
</svelte:head>

{#if !roomCode}
	<div class="shell room-shell">
		<section class="panel state-panel">
			<p class="eyebrow">Invalid room code</p>
			<h1>That room code does not exist in this cut.</h1>
			<p class="quiet">Room codes use six characters from A-Z without I/O and digits 2-9.</p>
		</section>
	</div>
{:else if roomLookupQuery.error}
	<div class="shell room-shell">
		<section class="panel state-panel">
			<p class="eyebrow">Connection error</p>
			<h1>The Convex room query failed.</h1>
			<p class="quiet">{roomLookupQuery.error.message}</p>
		</section>
	</div>
{:else if roomLookupQuery.isLoading}
	<div class="shell room-shell">
		<section class="panel state-panel">
			<p class="eyebrow">Loading</p>
			<h1>Opening the screening room...</h1>
			<p class="quiet">Waiting for the live Convex subscription to settle.</p>
		</section>
	</div>
{:else if roomLookup?.kind === 'not_found'}
	<div class="shell room-shell">
		<section class="panel state-panel">
			<p class="eyebrow">Missing room</p>
			<h1>Nothing active is stored under {roomCode}.</h1>
			<p class="quiet">The room may have expired due to inactivity.</p>
			<button class="ghost-action" on:click={() => goto('/')} type="button">Back to lobby</button>
		</section>
	</div>
{:else if roomLookup?.kind === 'forbidden'}
	<div class="shell room-shell">
		<section class="panel private-panel" in:fade={{ duration: 220 }}>
			<p class="eyebrow">Private room</p>
			<h1>Enter the access code for room {roomCode}.</h1>
			<p class="quiet">Convex checks the gate server-side before the room subscription opens.</p>
			<form class="private-form" on:submit|preventDefault={onPrivateJoin}>
				<label class="field">
					<span>Access code</span>
					<input bind:value={draftAccessCode} maxlength="16" placeholder="midnight-cut" type="text" />
				</label>
				{#if hasAttemptedJoin}
					<p class="error-banner">That access code does not match this room.</p>
				{/if}
				<button class="primary-action" type="submit">Join Room</button>
			</form>
		</section>
	</div>
{:else if room}
	<div class="shell room-shell">
		<section class="room-heading" in:fly={{ y: 24, duration: 620, easing: quintOut }}>
			<div>
				<p class="eyebrow">SvelteKit frontend · Convex room</p>
				<h1>Room {room.roomCode}</h1>
				<p class="quiet">
					Owner: {room.createdByDisplayName} · {onlineParticipantCount} active participant{onlineParticipantCount === 1
						? ''
						: 's'}
				</p>
			</div>

			<div class="heading-actions">
				<span class="mini-badge">{room.visibility.kind}</span>
				<span class:off={!soundboardEnabled} class="mini-badge">soundboard</span>
				<a class="ghost-action" href={room.watchUrl} rel="noreferrer" target="_blank">Open watch link</a>
			</div>
		</section>

		<section class="room-grid">
			<div class="panel stage-panel" in:fly={{ y: 28, delay: 60, duration: 660, easing: quintOut }}>
				<div class="panel-header stage-header">
					<div>
						<p class="eyebrow">Shared stage</p>
						<h2>Cursor mode when you annotate, interact mode when you click the film.</h2>
					</div>
					<div class="stage-modes">
						<button
							class:active={stageMode === 'cursor'}
							on:click={() => {
								stageMode = 'cursor';
							}}
							type="button"
						>
							Cursor
						</button>
						<button
							class:active={stageMode === 'interact'}
							disabled={!canUseStageInteraction}
							on:click={() => {
								stageMode = 'interact';
								optimisticCursor = null;
							}}
							type="button"
						>
							Interact
						</button>
					</div>
				</div>

				<p class="quiet stage-copy">{stageStatusMessage}</p>

				<div bind:this={cursorContainer} class="stage-frame">
					<div class="frame-glow"></div>
					<iframe
						allowfullscreen
						class:locked={!stageIsInteractive}
						class="stage-iframe"
						referrerpolicy="strict-origin-when-cross-origin"
						src={watchFrameUrl ?? room.watchUrl}
						title={`Room ${room.roomCode} watch frame`}
					></iframe>

					{#if !stageIsInteractive}
						<div
							aria-hidden="true"
							class="cursor-layer"
							on:pointerleave={onPointerLeave}
							on:pointermove={onCursorMove}
							role="presentation"
						></div>
					{/if}

					{#each renderedCursors as cursor (cursor.sessionId)}
						<StageCursor
							color={cursor.color}
							displayName={cursor.displayName}
							isSelf={cursor.sessionId === $sessionProfile.sessionId}
							x={cursor.x}
							y={cursor.y}
						/>
					{/each}
				</div>
			</div>

			<div class="stack">
				<section class="panel dock-panel" in:fly={{ y: 28, delay: 120, duration: 660, easing: quintOut }}>
					<div class="panel-header">
						<p class="eyebrow">Dock</p>
						<h2>Soundboard</h2>
					</div>

					<div class="sound-grid">
						{#each sounds as sound}
							<button
								class="sound-button"
								disabled={!soundboardEnabled}
								on:click={() => onSoundButtonClick(sound.id)}
								type="button"
							>
								{sound.label}
							</button>
						{/each}
					</div>

					{#if soundError}
						<p class="error-banner">{soundError}</p>
					{/if}

					<div class="event-log">
						<p class="eyebrow">Recent sounds</p>
						{#if soundEvents.length === 0}
							<p class="quiet">Still quiet. Hit a sting and the ledger updates.</p>
						{:else}
							<div class="log-stack">
								{#each soundEvents.slice(-6) as event (event.eventId)}
									<p>{event.actorDisplayName} played {event.soundId}</p>
								{/each}
							</div>
						{/if}
					</div>
				</section>

				<section class="panel presence-panel" in:fly={{ y: 28, delay: 170, duration: 660, easing: quintOut }}>
					<div class="panel-header">
						<p class="eyebrow">Presence</p>
						<h2>Your session</h2>
					</div>

					<label class="field">
						<span>Display name</span>
						<input
							on:input={(event) => updateDisplayName((event.currentTarget as HTMLInputElement).value)}
							value={$sessionProfile.displayName}
						/>
					</label>

					<div class="session-metadata">
						<p><span>Session</span><code>{$sessionProfile.sessionId}</code></p>
						<p><span>Owner key</span><code>{$sessionProfile.sessionSecret}</code></p>
						<p>
							<span>Cursor tint</span>
							<strong class="swatch" style={`--swatch:${$sessionProfile.color};`}>
								{$sessionProfile.color}
							</strong>
						</p>
					</div>
				</section>

				{#if isOwner}
					<section class="panel owner-panel" in:fly={{ y: 28, delay: 220, duration: 660, easing: quintOut }}>
						<div class="panel-header">
							<p class="eyebrow">Owner controls</p>
							<h2>Room policy</h2>
						</div>

						<div class="policy-card">
							<div class="policy-header">
								<div>
									<p class="switch-title">Manual mode</p>
									<p class="quiet">Auto mode falls back to the default crowd ceiling.</p>
								</div>
								<label class="switch">
									<input
										checked={effectiveOwnerPolicy?.kind === 'manual'}
										on:change={(event) => {
											const checked = (event.currentTarget as HTMLInputElement).checked;
											if (!effectiveOwnerPolicy) {
												return;
											}
											ownerDraftPolicy = checked
												? effectiveOwnerPolicy.kind === 'manual'
													? effectiveOwnerPolicy
													: {
															kind: 'manual',
															enabled: true,
															maxParticipants: effectiveOwnerPolicy.defaultMaxParticipants
														}
												: effectiveOwnerPolicy.kind === 'auto'
													? effectiveOwnerPolicy
													: {
															kind: 'auto',
															defaultMaxParticipants: effectiveOwnerPolicy.maxParticipants
														};
										}}
										type="checkbox"
									/>
									<span></span>
								</label>
							</div>

							{#if effectiveOwnerPolicy?.kind === 'manual'}
								<div class="manual-controls">
									<label class="checkline">
										<input
											checked={effectiveOwnerPolicy.enabled}
											on:change={(event) => {
												if (effectiveOwnerPolicy?.kind !== 'manual') {
													return;
												}
												ownerDraftPolicy = {
													...effectiveOwnerPolicy,
													enabled: (event.currentTarget as HTMLInputElement).checked
												};
											}}
											type="checkbox"
										/>
										<span>Enable soundboard</span>
									</label>
								</div>
							{/if}

							<div class="policy-card subtle-card">
								<div class="policy-header">
									<div>
										<p class="switch-title">Guest video controls</p>
										<p class="quiet">
											Allow non-owners to click play, pause, and scrub inside the shared stage.
										</p>
									</div>
									<label class="switch">
										<input
											checked={effectiveStagePolicy?.kind === 'everyone'}
											on:change={(event) => {
												ownerDraftStagePolicy = {
													kind: (event.currentTarget as HTMLInputElement).checked
														? 'everyone'
														: 'owner_only'
												};
											}}
											type="checkbox"
										/>
										<span></span>
									</label>
								</div>
							</div>

							<div class="participant-policy">
								<div>
									<p class="switch-title">Participant access</p>
									<p class="quiet">
										Grant direct stage control to specific guests when room-wide guest controls are off.
									</p>
								</div>

								{#if manageableParticipants.length === 0}
									<p class="quiet">Participants appear here after they join the room.</p>
								{:else}
									<div class="participant-stack">
										{#each manageableParticipants as participant (participant.sessionId)}
											<div class="participant-row">
												<div class="participant-copy">
													<div class="participant-topline">
														<span
															class="participant-dot"
															style={`background-color:${participant.color};`}
														></span>
														<p>{participant.displayName}</p>
														<span class:offline={!participant.online} class="participant-status">
															{participant.online ? 'online' : 'offline'}
														</span>
													</div>
													<p class="quiet participant-note">
														{effectiveStagePolicy?.kind === 'everyone'
															? 'Room-wide guest controls are on. Individual grants are stored but not needed right now.'
															: participant.capabilities.includes('stage_control')
																? 'Has direct stage control when guests are otherwise locked.'
																: 'No direct stage control.'}
													</p>
												</div>
												<label class="switch">
													<input
														checked={participant.capabilities.includes('stage_control')}
														disabled={effectiveStagePolicy?.kind === 'everyone' ||
															updatingParticipantSessionId === participant.sessionId}
														on:change={() => onToggleParticipantStageControl(participant)}
														type="checkbox"
													/>
													<span></span>
												</label>
											</div>
										{/each}
									</div>
								{/if}
							</div>

							<label class="slider-line">
								<span>Max participants</span>
								<strong>
									{effectiveOwnerPolicy?.kind === 'manual'
										? effectiveOwnerPolicy.maxParticipants
										: effectiveOwnerPolicy?.defaultMaxParticipants ?? 0}
								</strong>
								<input
									max="40"
									min="2"
									on:input={(event) => {
										const value = Number((event.currentTarget as HTMLInputElement).value);
										if (!effectiveOwnerPolicy) {
											return;
										}
										ownerDraftPolicy =
											effectiveOwnerPolicy.kind === 'manual'
												? { ...effectiveOwnerPolicy, maxParticipants: value }
												: { ...effectiveOwnerPolicy, defaultMaxParticipants: value };
									}}
									type="range"
									value={effectiveOwnerPolicy?.kind === 'manual'
										? effectiveOwnerPolicy.maxParticipants
										: effectiveOwnerPolicy?.defaultMaxParticipants ?? 8}
								/>
							</label>

							<div class="owner-actions">
								<button
									class="primary-action compact"
									disabled={!settingsDirty}
									on:click={onSaveOwnerSettings}
									type="button"
								>
									Save settings
								</button>
							</div>
						</div>

						{#if settingsError}
							<p class="error-banner">{settingsError}</p>
						{/if}

						{#if participantAccessError}
							<p class="error-banner">{participantAccessError}</p>
						{/if}
					</section>
				{/if}
			</div>
		</section>
	</div>
{/if}

<style>
	.room-shell {
		padding-bottom: 3rem;
	}

	.state-panel,
	.private-panel {
		max-width: 42rem;
		padding: 1.6rem;
	}

	.state-panel h1,
	.private-panel h1,
	.room-heading h1,
	.stage-header h2,
	.panel-header h2 {
		margin: 0;
		font-family: var(--font-display);
		line-height: 0.98;
		letter-spacing: -0.045em;
	}

	.private-panel h1,
	.state-panel h1 {
		font-size: clamp(2.8rem, 8vw, 4.8rem);
		margin-top: 0.3rem;
	}

	.private-form {
		margin-top: 1.2rem;
	}

	.room-heading {
		display: grid;
		gap: 1rem;
		margin-bottom: 1.35rem;
	}

	.room-heading h1 {
		font-size: clamp(2.8rem, 7vw, 5rem);
	}

	.heading-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
	}

	.mini-badge {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		border: 1px solid var(--line-soft);
		background: color-mix(in oklch, white 78%, var(--paper-shadow) 22%);
		padding: 0.5rem 0.78rem;
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.mini-badge.off {
		color: var(--ink-soft);
	}

	.room-grid {
		display: grid;
		gap: 1.35rem;
	}

	.stage-panel,
	.dock-panel,
	.owner-panel,
	.presence-panel {
		padding: 1.25rem;
	}

	.stage-header {
		display: grid;
		gap: 1rem;
	}

	.stage-header h2,
	.panel-header h2 {
		font-size: 1.9rem;
	}

	.stage-modes {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.4rem;
		border: 1px solid var(--line-soft);
		border-radius: 999px;
		background: color-mix(in oklch, white 82%, var(--paper-shadow) 18%);
	}

	.stage-modes button {
		border: none;
		border-radius: 999px;
		background: transparent;
		padding: 0.65rem 0.95rem;
		cursor: pointer;
		font-weight: 700;
		letter-spacing: 0.03em;
		transition:
			background 160ms var(--ease-out-quart),
			color 160ms var(--ease-out-quart),
			transform 160ms var(--ease-out-quart),
			opacity 160ms var(--ease-out-quart);
	}

	.stage-modes button.active {
		background:
			linear-gradient(135deg, color-mix(in oklch, var(--ink) 88%, white 12%), color-mix(in oklch, var(--signal-strong) 52%, var(--ink) 48%));
		color: white;
		box-shadow: 0 12px 24px rgba(54, 35, 18, 0.18);
	}

	.stage-modes button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.stage-copy {
		margin-top: 0.8rem;
	}

	.stage-frame {
		position: relative;
		overflow: hidden;
		margin-top: 1rem;
		min-height: 27rem;
		border-radius: 2rem;
		border: 1px solid color-mix(in oklch, var(--signal) 24%, white 76%);
		background:
			radial-gradient(circle at top, color-mix(in oklch, var(--signal-wash) 36%, transparent 64%), transparent 34%),
			linear-gradient(180deg, oklch(21% 0.03 22), oklch(18% 0.02 28));
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.16),
			0 28px 60px rgba(56, 35, 18, 0.28);
	}

	.frame-glow {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.15), transparent 24%),
			repeating-linear-gradient(
				90deg,
				rgba(255, 255, 255, 0.04) 0 2px,
				transparent 2px 36px
			);
		pointer-events: none;
	}

	.stage-iframe {
		position: absolute;
		inset: 0.7rem;
		width: calc(100% - 1.4rem);
		height: calc(100% - 1.4rem);
		border: none;
		border-radius: 1.45rem;
		background: oklch(18% 0.02 28);
	}

	.stage-iframe.locked {
		pointer-events: none;
	}

	.cursor-layer {
		position: absolute;
		inset: 0.7rem;
		border-radius: 1.45rem;
		cursor: none;
	}

	.stack {
		display: grid;
		gap: 1.35rem;
	}

	.sound-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.sound-button {
		border: 1px solid var(--line-soft);
		border-radius: 1.2rem;
		background: color-mix(in oklch, white 84%, var(--paper-shadow) 16%);
		padding: 0.9rem;
		cursor: pointer;
		font-weight: 700;
		letter-spacing: 0.02em;
		transition:
			transform 160ms var(--ease-out-quart),
			border-color 160ms var(--ease-out-quart),
			background 160ms var(--ease-out-quart);
	}

	.sound-button:hover:enabled {
		transform: translateY(-2px);
		border-color: color-mix(in oklch, var(--signal) 46%, white 54%);
		background: color-mix(in oklch, white 62%, var(--signal-wash) 38%);
	}

	.sound-button:disabled {
		cursor: not-allowed;
		opacity: 0.48;
	}

	.event-log {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--line-soft);
	}

	.log-stack {
		display: grid;
		gap: 0.45rem;
		margin-top: 0.65rem;
		color: var(--ink-soft);
		font-size: 0.92rem;
	}

	.panel-header {
		display: grid;
		gap: 0.2rem;
	}

	.field {
		display: grid;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.field span,
	.switch-title {
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.field input,
	.private-form input {
		border: 1px solid var(--line-soft);
		border-radius: 1.25rem;
		background: color-mix(in oklch, white 82%, var(--paper-shadow) 18%);
		padding: 0.95rem 1rem;
		color: var(--ink);
		outline: none;
		transition:
			border-color 160ms var(--ease-out-quart),
			box-shadow 160ms var(--ease-out-quart),
			transform 160ms var(--ease-out-quart);
	}

	.field input:focus,
	.private-form input:focus {
		border-color: color-mix(in oklch, var(--signal) 44%, white 56%);
		box-shadow: 0 0 0 4px color-mix(in oklch, var(--signal-wash) 36%, transparent 64%);
		transform: translateY(-1px);
	}

	.session-metadata {
		display: grid;
		gap: 0.7rem;
		margin-top: 1rem;
		border-top: 1px solid var(--line-soft);
		padding-top: 1rem;
	}

	.session-metadata p {
		display: grid;
		gap: 0.22rem;
		margin: 0;
	}

	.session-metadata span {
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.session-metadata code {
		overflow-wrap: anywhere;
		font-size: 0.78rem;
	}

	.swatch {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
	}

	.swatch::before {
		content: '';
		display: inline-flex;
		height: 0.85rem;
		width: 0.85rem;
		border-radius: 999px;
		background: var(--swatch);
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.74);
	}

	.policy-card {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
		border: 1px solid var(--line-soft);
		border-radius: 1.7rem;
		background: color-mix(in oklch, white 68%, var(--signal-wash) 32%);
		padding: 1rem;
	}

	.policy-header {
		display: flex;
		gap: 1rem;
		align-items: start;
		justify-content: space-between;
	}

	.subtle-card {
		margin-top: 0;
	}

	.participant-policy {
		display: grid;
		gap: 0.85rem;
		padding: 1rem 0 0;
		border-top: 1px solid var(--line-soft);
	}

	.participant-stack {
		display: grid;
		gap: 0.75rem;
	}

	.participant-row {
		display: flex;
		gap: 0.8rem;
		align-items: start;
		justify-content: space-between;
		border: 1px solid var(--line-soft);
		border-radius: 1.15rem;
		background: color-mix(in oklch, white 78%, var(--paper-shadow) 22%);
		padding: 0.9rem;
	}

	.participant-copy {
		min-width: 0;
	}

	.participant-topline {
		display: flex;
		gap: 0.45rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.participant-topline p {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.participant-dot {
		display: inline-flex;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
	}

	.participant-status {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		background: color-mix(in oklch, var(--moss) 18%, white 82%);
		padding: 0.18rem 0.5rem;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: color-mix(in oklch, var(--moss) 64%, black 36%);
	}

	.participant-status.offline {
		background: color-mix(in oklch, black 10%, white 90%);
		color: var(--ink-soft);
	}

	.participant-note {
		margin-top: 0.35rem;
		font-size: 0.82rem;
	}

	.manual-controls {
		display: grid;
		gap: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--line-soft);
	}

	.checkline,
	.slider-line {
		display: grid;
		gap: 0.45rem;
	}

	.checkline {
		grid-template-columns: auto 1fr;
		align-items: center;
	}

	.checkline span,
	.slider-line span {
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		text-transform: none;
	}

	.owner-actions {
		display: flex;
		justify-content: flex-start;
	}

	.switch {
		position: relative;
		display: inline-flex;
		flex: none;
	}

	.switch input {
		position: absolute;
		inset: 0;
		opacity: 0;
	}

	.switch span {
		display: inline-flex;
		height: 2rem;
		width: 3.6rem;
		align-items: center;
		border-radius: 999px;
		background: color-mix(in oklch, var(--ink) 22%, white 78%);
		padding: 0.2rem;
		transition: background 160ms var(--ease-out-quart);
	}

	.switch span::after {
		content: '';
		height: 1.35rem;
		width: 1.35rem;
		border-radius: 999px;
		background: white;
		box-shadow: 0 4px 12px rgba(56, 35, 16, 0.16);
		transition: transform 180ms var(--ease-out-quart);
	}

	.switch input:checked + span {
		background: color-mix(in oklch, var(--signal) 62%, white 38%);
	}

	.switch input:checked + span::after {
		transform: translateX(1.55rem);
	}

	.switch input:disabled + span {
		opacity: 0.5;
	}

	.primary-action,
	.ghost-action {
		border: none;
		border-radius: 1.4rem;
		cursor: pointer;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-decoration: none;
	}

	.primary-action {
		background:
			linear-gradient(135deg, color-mix(in oklch, var(--ink) 88%, white 12%), color-mix(in oklch, var(--signal-strong) 52%, var(--ink) 48%));
		padding: 0.95rem 1.15rem;
		color: white;
		box-shadow: 0 16px 36px rgba(59, 37, 18, 0.18);
	}

	.primary-action.compact {
		padding: 0.82rem 1rem;
	}

	.primary-action:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.ghost-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--line-soft);
		background: color-mix(in oklch, white 84%, var(--paper-shadow) 16%);
		padding: 0.75rem 1rem;
		color: var(--ink);
	}

	.error-banner {
		margin: 1rem 0 0;
		border: 1px solid color-mix(in oklch, var(--alert) 42%, white 58%);
		border-radius: 1rem;
		background: color-mix(in oklch, var(--alert) 12%, white 88%);
		padding: 0.8rem 0.9rem;
		color: color-mix(in oklch, var(--alert) 86%, black 14%);
		font-size: 0.92rem;
		line-height: 1.5;
	}

	@media (min-width: 1024px) {
		.room-grid {
			grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.65fr);
			align-items: start;
		}
	}
</style>
