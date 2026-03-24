<svelte:options runes={false} />

<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { quintOut } from 'svelte/easing';
	import { fade, fly, scale } from 'svelte/transition';
	import {
		DEFAULT_AUTO_SOUNDBOARD_CAPACITY,
		createRoomInputSchema,
		type SoundboardPolicy
	} from '$lib/teleparty-domain';
	import {
		createRoomRecord,
		hydrateRooms,
		listPublicRooms,
		roomsReady,
		roomsStore
	} from '$lib/rooms';
	import {
		hydrateSessionProfile,
		sessionProfile,
		sessionReady,
		updateSessionProfile
	} from '$lib/session';

	const cinematicPresets = [
		{
			label: 'Director commentary',
			url: 'https://www.youtube.com/watch?v=akVP_TF7jDI'
		},
		{
			label: 'Title sequence',
			url: 'https://www.youtube.com/watch?v=ScMzIvxBSi4'
		},
		{
			label: 'Late-night cut',
			url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
		}
	];

	let watchUrl = '';
	let isPrivate = false;
	let accessCode = '';
	let draftSoundboardPolicy: SoundboardPolicy = {
		kind: 'auto',
		defaultMaxParticipants: DEFAULT_AUTO_SOUNDBOARD_CAPACITY
	};
	let isSubmitting = false;
	let error: string | null = null;

	$: publicRooms = listPublicRooms($roomsStore);

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

	async function onCreateRoomSubmit() {
		error = null;
		isSubmitting = true;

		try {
			if (!$sessionReady) {
				throw new Error('Session is still loading. Retry in a moment.');
			}

			const parsed = createRoomInputSchema.parse({
				watchUrl,
				visibility: isPrivate
					? {
							kind: 'private' as const,
							accessCode
						}
					: {
							kind: 'public' as const
						},
				soundboardPolicy: draftSoundboardPolicy
			});

			const room = createRoomRecord({
				watchUrl: parsed.watchUrl,
				visibility: parsed.visibility,
				soundboardPolicy: parsed.soundboardPolicy,
				sessionProfile: $sessionProfile
			});

			await goto(`/rooms/${room.roomCode}`);
		} catch (unknownError) {
			error =
				unknownError instanceof Error
					? unknownError.message
					: 'Failed to create room. Please retry.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Teleparty Studio / SvelteKit Spike</title>
	<meta
		name="description"
		content="A cinematic SvelteKit spike for local-first watch rooms, built to evaluate what Svelte can do for Teleparty."
	/>
</svelte:head>

<div class="shell">
	<section class="hero">
		<div class="hero-copy" in:fly={{ y: 36, duration: 650, easing: quintOut }}>
			<p class="eyebrow">Experimental SvelteKit Spike · Local-first Preview</p>
			<h1 class="hero-title">Build a screening room from any link.</h1>
			<p class="hero-body">
				This version is about feel. It swaps boilerplate cards for an editorial stage,
				keeps the flow local and instant, and uses Svelte-native motion to make the
				interface breathe.
			</p>
			<div class="preset-strip">
				{#each cinematicPresets as preset, index (preset.label)}
					<button
						class="preset-chip"
						in:scale={{ delay: 120 + index * 70, duration: 420, easing: quintOut, start: 0.92 }}
						on:click={() => {
							watchUrl = preset.url;
						}}
						type="button"
					>
						{preset.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="hero-mast panel" in:fade={{ delay: 180, duration: 600 }}>
			<p class="mast-label">Why this spike exists</p>
			<ul class="mast-list">
				<li>Push the stage UI toward something more cinematic and tactile</li>
				<li>Test SvelteKit’s calmer SSR and route composition model</li>
				<li>Use the new Impeccable design bundle instead of generic defaults</li>
			</ul>
		</div>
	</section>

	<section class="dashboard">
		<form
			class="panel creation-panel"
			in:fly={{ y: 28, delay: 80, duration: 650, easing: quintOut }}
			on:submit|preventDefault={onCreateRoomSubmit}
		>
			<div class="panel-header">
				<p class="eyebrow">Studio</p>
				<h2>Create Room</h2>
				<p class="quiet">
					Local-first for now, but the product shape mirrors the existing Teleparty
					flow.
				</p>
			</div>

			<label class="field">
				<span>Watch link</span>
				<input
					bind:value={watchUrl}
					placeholder="https://www.youtube.com/watch?v=..."
					type="url"
				/>
			</label>

			<div class="switch-card">
				<div>
					<p class="switch-title">Private room</p>
					<p class="quiet">Turn on access code gating for a smaller screening.</p>
				</div>
				<label class="switch">
					<input bind:checked={isPrivate} type="checkbox" />
					<span></span>
				</label>
			</div>

			{#if isPrivate}
				<label class="field" transition:fade={{ duration: 180 }}>
					<span>Access code</span>
					<input bind:value={accessCode} maxlength="16" placeholder="midnight-cut" type="text" />
				</label>
			{/if}

			<div class="policy-card">
				<div class="policy-header">
					<div>
						<p class="switch-title">Owner-controlled soundboard</p>
						<p class="quiet">Manual mode lets you explicitly gate the room’s chaos level.</p>
					</div>
					<label class="switch">
						<input
							checked={draftSoundboardPolicy.kind === 'manual'}
							on:change={(event) => {
								const checked = (event.currentTarget as HTMLInputElement).checked;
								draftSoundboardPolicy = checked
									? {
											kind: 'manual',
											enabled: true,
											maxParticipants: DEFAULT_AUTO_SOUNDBOARD_CAPACITY
										}
									: {
											kind: 'auto',
											defaultMaxParticipants: DEFAULT_AUTO_SOUNDBOARD_CAPACITY
										};
							}}
							type="checkbox"
						/>
						<span></span>
					</label>
				</div>

				{#if draftSoundboardPolicy.kind === 'manual'}
					<div class="manual-controls" transition:fade={{ duration: 180 }}>
						<label class="checkline">
							<input
								checked={draftSoundboardPolicy.enabled}
								on:change={(event) => {
									draftSoundboardPolicy =
										draftSoundboardPolicy.kind === 'manual'
											? {
													...draftSoundboardPolicy,
													enabled: (event.currentTarget as HTMLInputElement).checked
												}
											: draftSoundboardPolicy;
								}}
								type="checkbox"
							/>
							<span>Enable soundboard</span>
						</label>

						<label class="slider-line">
							<span>Max participants</span>
							<strong>{draftSoundboardPolicy.maxParticipants}</strong>
							<input
								bind:value={draftSoundboardPolicy.maxParticipants}
								max="24"
								min="2"
								type="range"
							/>
						</label>
					</div>
				{/if}
			</div>

			{#if error}
				<p class="error-banner" transition:fade>{error}</p>
			{/if}

			<button class="primary-action" disabled={isSubmitting || !$sessionReady} type="submit">
				{isSubmitting ? 'Cutting the room...' : 'Create Room'}
			</button>
		</form>

		<aside class="stack">
			<section
				class="panel session-panel"
				in:fly={{ y: 28, delay: 130, duration: 650, easing: quintOut }}
			>
				<div class="panel-header">
					<p class="eyebrow">Presence</p>
					<h2>Your Session</h2>
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

			<section
				class="panel vault-panel"
				in:fly={{ y: 28, delay: 180, duration: 650, easing: quintOut }}
			>
				<div class="panel-header">
					<p class="eyebrow">Vault</p>
					<h2>Public Rooms</h2>
					<p class="quiet">Saved locally so you can jump back in fast while evaluating the spike.</p>
				</div>

				{#if !$roomsReady}
					<p class="quiet">Opening the local vault...</p>
				{:else if publicRooms.length === 0}
					<div class="empty-state">
						<p class="empty-title">No public rooms yet.</p>
						<p class="quiet">
							Create one above and this area turns into a little screening ledger.
						</p>
					</div>
				{:else}
					<div class="room-ledger">
						{#each publicRooms as room, index (room.roomCode)}
							<button
								class="room-entry"
								in:fly={{ x: 18, delay: 120 + index * 60, duration: 420, easing: quintOut }}
								on:click={() => goto(`/rooms/${room.roomCode}`)}
								type="button"
							>
								<span class="room-host">{room.watchHost}</span>
								<strong>Room {room.roomCode}</strong>
								<span class="quiet">Hosted by {room.ownerDisplayName}</span>
							</button>
						{/each}
					</div>
				{/if}
			</section>
		</aside>
	</section>
</div>

<style>
	.hero {
		display: grid;
		gap: 1.5rem;
		margin-bottom: 1.8rem;
	}

	.hero-copy {
		max-width: 48rem;
	}

	.hero-title {
		margin: 0;
		max-width: 12ch;
		font-family: var(--font-display);
		font-size: clamp(3.5rem, 8vw, 6.8rem);
		line-height: 0.95;
		letter-spacing: -0.05em;
	}

	.hero-body {
		margin: 1.35rem 0 0;
		max-width: 38rem;
		color: var(--ink-soft);
		font-size: 1.08rem;
		line-height: 1.72;
	}

	.hero-mast {
		align-self: end;
		max-width: 28rem;
	}

	.mast-label {
		margin: 0;
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--signal);
	}

	.mast-list {
		margin: 1rem 0 0;
		padding-left: 1rem;
		color: var(--ink-soft);
		line-height: 1.7;
	}

	.preset-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-top: 1.6rem;
	}

	.preset-chip {
		border: 1px solid var(--line-soft);
		border-radius: 999px;
		background: color-mix(in oklch, white 72%, var(--signal-wash) 28%);
		padding: 0.65rem 0.95rem;
		color: var(--ink);
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		transition:
			transform 180ms var(--ease-out-quart),
			border-color 180ms var(--ease-out-quart),
			background 180ms var(--ease-out-quart);
	}

	.preset-chip:hover {
		transform: translateY(-2px);
		border-color: var(--signal);
		background: color-mix(in oklch, white 48%, var(--signal-wash) 52%);
	}

	.dashboard {
		display: grid;
		gap: 1.4rem;
	}

	.creation-panel,
	.session-panel,
	.vault-panel {
		padding: 1.35rem;
	}

	.panel-header h2 {
		margin: 0.15rem 0 0;
		font-family: var(--font-display);
		font-size: 2rem;
		letter-spacing: -0.04em;
	}

	.quiet {
		margin: 0;
		color: var(--ink-soft);
		line-height: 1.6;
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

	.field input {
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

	.field input:focus {
		border-color: color-mix(in oklch, var(--signal) 44%, white 56%);
		box-shadow: 0 0 0 4px color-mix(in oklch, var(--signal-wash) 36%, transparent 64%);
		transform: translateY(-1px);
	}

	.switch-card,
	.policy-card {
		margin-top: 1rem;
		border: 1px solid var(--line-soft);
		border-radius: 1.7rem;
		background: color-mix(in oklch, white 68%, var(--signal-wash) 32%);
		padding: 1rem;
	}

	.switch-card,
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
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--line-soft);
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
	}

	.slider-line strong {
		font-family: var(--font-display);
		font-size: 1.6rem;
	}

	input[type='range'] {
		accent-color: var(--signal-strong);
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

	.primary-action {
		margin-top: 1rem;
		width: 100%;
		border: none;
		border-radius: 1.4rem;
		background:
			linear-gradient(135deg, color-mix(in oklch, var(--signal-strong) 78%, white 22%), color-mix(in oklch, var(--moss) 74%, white 26%));
		padding: 1rem 1.2rem;
		color: white;
		cursor: pointer;
		font-size: 0.98rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		transition:
			transform 180ms var(--ease-out-quart),
			box-shadow 180ms var(--ease-out-quart);
		box-shadow: 0 18px 34px rgba(71, 53, 27, 0.22);
	}

	.primary-action:hover:enabled {
		transform: translateY(-2px);
		box-shadow: 0 24px 44px rgba(71, 53, 27, 0.28);
	}

	.primary-action:disabled {
		cursor: wait;
		opacity: 0.7;
	}

	.stack {
		display: grid;
		gap: 1.4rem;
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

	.empty-state {
		border: 1px dashed var(--line-soft);
		border-radius: 1.3rem;
		padding: 1.15rem;
	}

	.empty-title {
		margin: 0 0 0.45rem;
		font-family: var(--font-display);
		font-size: 1.3rem;
	}

	.room-ledger {
		display: grid;
		gap: 0.8rem;
	}

	.room-entry {
		display: grid;
		gap: 0.22rem;
		border: 1px solid var(--line-soft);
		border-radius: 1.3rem;
		background: color-mix(in oklch, white 78%, var(--paper-shadow) 22%);
		padding: 0.95rem 1rem;
		color: inherit;
		cursor: pointer;
		text-align: left;
		transition:
			transform 160ms var(--ease-out-quart),
			border-color 160ms var(--ease-out-quart),
			background 160ms var(--ease-out-quart);
	}

	.room-entry:hover {
		transform: translateY(-3px);
		border-color: color-mix(in oklch, var(--signal) 42%, white 58%);
		background: color-mix(in oklch, white 62%, var(--signal-wash) 38%);
	}

	.room-host {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--signal);
	}

	@media (min-width: 960px) {
		.hero {
			grid-template-columns: minmax(0, 1.35fr) minmax(22rem, 0.65fr);
			align-items: end;
		}

		.dashboard {
			grid-template-columns: minmax(0, 1.1fr) minmax(22rem, 0.9fr);
			align-items: start;
		}
	}
</style>
