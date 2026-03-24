<svelte:options runes={false} />

<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { quintOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import StageCursor from '$lib/components/StageCursor.svelte';
	import StageDrawing from '$lib/components/StageDrawing.svelte';
	import { getRelativeCursorPosition } from '$lib/cursor-stage';
	import {
		canUseSoundboard,
		getWatchFrameUrl,
		normalizeRoomCode,
		type SoundboardPolicy
	} from '$lib/teleparty-domain';
	import type { StagePoint } from '$lib/rooms';
	import {
		addDrawingStroke,
		appendSoundEvent,
		clearDrawingStrokes,
		hydrateRooms,
		roomsReady,
		roomsStore,
		saveRoomSoundboardPolicy,
		validateRoomAccess
	} from '$lib/rooms';
	import {
		hydrateSessionProfile,
		sessionProfile,
		sessionReady,
		updateSessionProfile
	} from '$lib/session';
	import { playSound, sounds } from '$lib/soundboard';

	let draftAccessCode = '';
	let hasJoined = false;
	let joinError: string | null = null;
	let soundError: string | null = null;
	let drawError: string | null = null;
	let settingsError: string | null = null;
	let stageMode: 'interact' | 'cursor' | 'draw' = 'interact';
	let ownerDraftPolicy: SoundboardPolicy | null = null;
	let cursorContainer: HTMLDivElement | null = null;
	let optimisticCursor:
		| {
				color: string;
				displayName: string;
				sessionId: string;
				x: number;
				y: number;
		  }
		| null = null;
	let draftStroke: StagePoint[] = [];
	let lastPolicySignature: string | null = null;

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

	$: room = roomCode
		? $roomsStore.find((candidate) => candidate.roomCode === roomCode) ?? null
		: null;
	$: watchFrameUrl = room ? getWatchFrameUrl(room.watchUrl) : null;
	$: roomPolicy = room?.soundboardPolicy ?? null;
	$: roomPolicySignature = roomPolicy ? JSON.stringify(roomPolicy) : null;
	$: if (!roomPolicySignature) {
		lastPolicySignature = null;
		ownerDraftPolicy = null;
	} else if (lastPolicySignature !== roomPolicySignature) {
		lastPolicySignature = roomPolicySignature;
		ownerDraftPolicy = roomPolicy;
	}
	$: effectiveOwnerPolicy = ownerDraftPolicy ?? roomPolicy;
	$: settingsDirty =
		Boolean(roomPolicy && effectiveOwnerPolicy) &&
		JSON.stringify(roomPolicy) !== JSON.stringify(effectiveOwnerPolicy);
	$: participantCount = hasJoined ? 1 : 0;
	$: soundboardEnabled = roomPolicy ? canUseSoundboard(roomPolicy, participantCount) : false;
	$: isOwner = Boolean(room && room.ownerSessionId === $sessionProfile.sessionId);
	$: if (room?.visibility.kind === 'public' && $sessionReady) {
		hasJoined = true;
	}
	$: previewStroke =
		draftStroke.length >= 2
			? {
					color: $sessionProfile.color,
					points: draftStroke
				}
			: null;
	$: renderedParticipants = optimisticCursor
		? [
				{
					...optimisticCursor,
					x: optimisticCursor.x * 100,
					y: optimisticCursor.y * 100
				}
			]
		: [];

	onMount(() => {
		hydrateSessionProfile();
		hydrateRooms();
	});

	function updateDisplayName(value: string) {
		updateSessionProfile((current) => ({
			...current,
			displayName: value
		}));
	}

	function onPrivateJoin() {
		if (!room) {
			return;
		}

		if (!validateRoomAccess(room, draftAccessCode)) {
			hasJoined = false;
			joinError = 'That access code does not match this room.';
			return;
		}

		hasJoined = true;
		joinError = null;
	}

	function onPointerMove(event: PointerEvent) {
		if (stageMode !== 'cursor' || !hasJoined || !cursorContainer) {
			return;
		}

		const point = getRelativeCursorPosition(cursorContainer.getBoundingClientRect(), event);
		if (!point) {
			return;
		}

		optimisticCursor = {
			color: $sessionProfile.color,
			displayName: $sessionProfile.displayName,
			sessionId: $sessionProfile.sessionId,
			x: point.x,
			y: point.y
		};
	}

	function onPointerLeave() {
		optimisticCursor = null;
	}

	function getStagePoint(event: PointerEvent): StagePoint | null {
		if (!cursorContainer) {
			return null;
		}

		return getRelativeCursorPosition(cursorContainer.getBoundingClientRect(), event);
	}

	function onDrawPointerDown(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		if (stageMode !== 'draw' || !hasJoined) {
			return;
		}

		const point = getStagePoint(event);
		if (!point) {
			return;
		}

		event.currentTarget.setPointerCapture(event.pointerId);
		draftStroke = [point];
		drawError = null;
	}

	function onDrawPointerMove(event: PointerEvent) {
		if (stageMode !== 'draw' || draftStroke.length === 0) {
			return;
		}

		const point = getStagePoint(event);
		if (!point) {
			return;
		}

		const lastPoint = draftStroke[draftStroke.length - 1];
		if (Math.abs(lastPoint.x - point.x) < 0.005 && Math.abs(lastPoint.y - point.y) < 0.005) {
			return;
		}

		draftStroke = [...draftStroke, point];
	}

	function commitDraftStroke() {
		if (!roomCode || draftStroke.length < 2) {
			draftStroke = [];
			return;
		}

		try {
			addDrawingStroke(roomCode, {
				color: $sessionProfile.color,
				points: draftStroke
			});
			drawError = null;
		} catch (error) {
			drawError = error instanceof Error ? error.message : 'Failed to save drawing.';
		} finally {
			draftStroke = [];
		}
	}

	function onDrawPointerUp(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		if (stageMode !== 'draw') {
			return;
		}

		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}

		commitDraftStroke();
	}

	function onSoundButtonClick(soundId: (typeof sounds)[number]['id']) {
		if (!roomCode || !hasJoined) {
			return;
		}

		try {
			appendSoundEvent(roomCode, $sessionProfile.displayName, soundId);
			playSound(soundId);
			soundError = null;
		} catch (error) {
			soundError = error instanceof Error ? error.message : 'Sound request failed.';
		}
	}

	function onSaveSettings() {
		if (!roomCode || !effectiveOwnerPolicy) {
			return;
		}

		try {
			saveRoomSoundboardPolicy(roomCode, $sessionProfile.sessionId, effectiveOwnerPolicy);
			settingsError = null;
		} catch (error) {
			settingsError =
				error instanceof Error ? error.message : 'Failed to save owner settings.';
		}
	}

	function onClearDrawings() {
		if (!roomCode) {
			return;
		}

		try {
			clearDrawingStrokes(roomCode, $sessionProfile.sessionId);
			drawError = null;
		} catch (error) {
			drawError = error instanceof Error ? error.message : 'Failed to clear drawings.';
		}
	}
</script>

<svelte:head>
	<title>{roomCode ? `Room ${roomCode} / SvelteKit Spike` : 'Room / SvelteKit Spike'}</title>
</svelte:head>

{#if !roomCode}
	<div class="shell room-shell">
		<section class="panel state-panel">
			<p class="eyebrow">Invalid room code</p>
			<h1>That room code does not exist in this cut.</h1>
		</section>
	</div>
{:else if !$roomsReady}
	<div class="shell room-shell">
		<section class="panel state-panel">
			<p class="eyebrow">Loading</p>
			<h1>Opening the screening room...</h1>
			<p class="quiet">This local-first spike reads from the browser vault on load.</p>
		</section>
	</div>
{:else if !room}
	<div class="shell room-shell">
		<section class="panel state-panel">
			<p class="eyebrow">Missing room</p>
			<h1>Nothing is stored under {roomCode}.</h1>
			<button class="ghost-action" on:click={() => goto('/')} type="button">Back to lobby</button>
		</section>
	</div>
{:else if room.visibility.kind === 'private' && !hasJoined}
	<div class="shell room-shell">
		<section class="panel private-panel" in:fade={{ duration: 220 }}>
			<p class="eyebrow">Private room</p>
			<h1>Enter the access code for room {room.roomCode}.</h1>
			<p class="quiet">This spike keeps room gates local, but the flow mirrors the main product.</p>
			<form class="private-form" on:submit|preventDefault={onPrivateJoin}>
				<label class="field">
					<span>Access code</span>
					<input bind:value={draftAccessCode} maxlength="16" placeholder="midnight-cut" type="text" />
				</label>
				{#if joinError}
					<p class="error-banner">{joinError}</p>
				{/if}
				<button class="primary-action" type="submit">Join Room</button>
			</form>
		</section>
	</div>
{:else}
	<div class="shell room-shell">
		<section class="room-heading" in:fly={{ y: 24, duration: 620, easing: quintOut }}>
			<div>
				<p class="eyebrow">SvelteKit spike · Local-first stage</p>
				<h1>Room {room.roomCode}</h1>
				<p class="quiet">
					Hosted by {room.ownerDisplayName} · {participantCount} active participant{participantCount === 1
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
						<h2>Interact, sketch, then cut back to the film.</h2>
					</div>
					<div class="stage-modes">
						<button
							class:active={stageMode === 'interact'}
							on:click={() => {
								stageMode = 'interact';
								optimisticCursor = null;
								draftStroke = [];
							}}
							type="button"
						>
							Interact
						</button>
						<button
							class:active={stageMode === 'cursor'}
							on:click={() => {
								stageMode = 'cursor';
								draftStroke = [];
							}}
							type="button"
						>
							Cursor
						</button>
						<button
							class:active={stageMode === 'draw'}
							on:click={() => {
								stageMode = 'draw';
								optimisticCursor = null;
							}}
							type="button"
						>
							Draw
						</button>
					</div>
				</div>

				<p class="quiet stage-copy">
					{stageMode === 'interact'
						? 'Video controls are live. Browser sandboxing still means the overlay goes quiet while you click inside the embed.'
						: stageMode === 'cursor'
							? 'Cursor mode turns the stage into a soft annotation layer.'
							: 'Draw mode lets you sketch directly over the frame and keep the marks in the local vault.'}
				</p>

				{#if drawError}
					<p class="error-banner" transition:fade>{drawError}</p>
				{/if}

				<div bind:this={cursorContainer} class="stage-frame">
					<div class="frame-glow"></div>
					<iframe
						allowfullscreen
						class:locked={stageMode !== 'interact'}
						class="stage-iframe"
						referrerpolicy="strict-origin-when-cross-origin"
						src={watchFrameUrl ?? room.watchUrl}
						title={`Room ${room.roomCode} watch frame`}
					></iframe>

					<StageDrawing previewStroke={previewStroke} strokes={room.drawingStrokes} />

					{#if stageMode === 'cursor'}
						<div
							aria-hidden="true"
							class="cursor-layer"
							on:pointerleave={onPointerLeave}
							on:pointermove={onPointerMove}
							role="presentation"
						></div>
					{/if}

					{#if stageMode === 'draw'}
						<div
							aria-hidden="true"
							class="draw-layer"
							on:pointercancel={onDrawPointerUp}
							on:pointerdown={onDrawPointerDown}
							on:pointermove={onDrawPointerMove}
							on:pointerup={onDrawPointerUp}
							role="presentation"
						></div>
					{/if}

					{#each renderedParticipants as participant (participant.sessionId)}
						<StageCursor
							color={participant.color}
							displayName={participant.displayName}
							isSelf={participant.sessionId === $sessionProfile.sessionId}
							x={participant.x}
							y={participant.y}
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
								disabled={!soundboardEnabled || !hasJoined}
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
						{#if room.soundEvents.length === 0}
							<p class="quiet">Still quiet. Hit a sting and the ledger updates.</p>
						{:else}
							<div class="log-stack">
								{#each [...room.soundEvents].reverse().slice(0, 6) as event (event.eventId)}
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

							<label class="slider-line">
								<span>Max participants</span>
								<strong>
									{effectiveOwnerPolicy?.kind === 'manual'
										? effectiveOwnerPolicy.maxParticipants
										: effectiveOwnerPolicy?.defaultMaxParticipants ?? 0}
								</strong>
								<input
									max="24"
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
								<button class="ghost-action" on:click={onClearDrawings} type="button">
									Clear drawings
								</button>
								<button
									class="primary-action compact"
									disabled={!settingsDirty}
									on:click={onSaveSettings}
									type="button"
								>
									Save settings
								</button>
							</div>
						</div>

						{#if settingsError}
							<p class="error-banner">{settingsError}</p>
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
			transform 160ms var(--ease-out-quart);
	}

	.stage-modes button.active {
		background:
			linear-gradient(135deg, color-mix(in oklch, var(--ink) 88%, white 12%), color-mix(in oklch, var(--signal-strong) 52%, var(--ink) 48%));
		color: white;
		box-shadow: 0 12px 24px rgba(54, 35, 18, 0.18);
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

	.cursor-layer,
	.draw-layer {
		position: absolute;
		inset: 0.7rem;
		border-radius: 1.45rem;
	}

	.cursor-layer {
		cursor: none;
	}

	.draw-layer {
		cursor: crosshair;
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
		display: flex;
		gap: 0.8rem;
		justify-content: space-between;
		margin: 0;
		align-items: center;
		font-size: 0.88rem;
	}

	code,
	.swatch {
		font-family: 'IBM Plex Mono', 'SFMono-Regular', ui-monospace, monospace;
	}

	code {
		max-width: 16ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--ink-soft);
	}

	.swatch {
		display: inline-flex;
		gap: 0.55rem;
		align-items: center;
	}

	.swatch::before {
		content: '';
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 999px;
		background: var(--swatch);
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8) inset;
	}

	.policy-card {
		margin-top: 1rem;
		border: 1px solid var(--line-soft);
		border-radius: 1.65rem;
		background: color-mix(in oklch, white 68%, var(--signal-wash) 32%);
		padding: 1rem;
	}

	.policy-header {
		display: flex;
		gap: 1rem;
		align-items: start;
		justify-content: space-between;
	}

	.switch {
		position: relative;
		display: inline-flex;
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

	.manual-controls {
		margin-top: 1rem;
	}

	.checkline {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		font-weight: 600;
	}

	.slider-line {
		display: grid;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.slider-line strong {
		font-family: var(--font-display);
		font-size: 1.6rem;
	}

	.owner-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		margin-top: 1rem;
	}

	.ghost-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--line-soft);
		border-radius: 999px;
		background: color-mix(in oklch, white 76%, var(--paper-shadow) 24%);
		padding: 0.72rem 1rem;
		color: inherit;
		cursor: pointer;
		font-weight: 700;
		text-decoration: none;
		transition:
			transform 160ms var(--ease-out-quart),
			border-color 160ms var(--ease-out-quart),
			background 160ms var(--ease-out-quart);
	}

	.ghost-action:hover {
		transform: translateY(-2px);
		border-color: color-mix(in oklch, var(--signal) 42%, white 58%);
		background: color-mix(in oklch, white 62%, var(--signal-wash) 38%);
	}

	.primary-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 1.35rem;
		background:
			linear-gradient(135deg, color-mix(in oklch, var(--signal-strong) 78%, white 22%), color-mix(in oklch, var(--moss) 74%, white 26%));
		padding: 0.95rem 1.2rem;
		color: white;
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		transition:
			transform 180ms var(--ease-out-quart),
			box-shadow 180ms var(--ease-out-quart);
		box-shadow: 0 18px 34px rgba(71, 53, 27, 0.22);
	}

	.primary-action.compact {
		padding-inline: 1.05rem;
	}

	.primary-action:hover:enabled {
		transform: translateY(-2px);
		box-shadow: 0 24px 44px rgba(71, 53, 27, 0.28);
	}

	.primary-action:disabled {
		cursor: not-allowed;
		opacity: 0.58;
	}

	.error-banner {
		margin: 1rem 0 0;
		border-radius: 1rem;
		background: color-mix(in oklch, var(--alert) 14%, white 86%);
		padding: 0.85rem 0.95rem;
		color: oklch(38% 0.12 24);
		font-size: 0.9rem;
		font-weight: 600;
	}

	@media (min-width: 1040px) {
		.room-heading {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: end;
		}

		.stage-header {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: start;
		}

		.room-grid {
			grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.7fr);
			align-items: start;
		}
	}
</style>
