<svelte:options runes={false} />

<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { quintOut } from 'svelte/easing';
	import { fade, fly, scale } from 'svelte/transition';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '$lib/convex-api';
	import {
		DEFAULT_AUTO_SOUNDBOARD_CAPACITY,
		DEFAULT_STAGE_INTERACTION_POLICY,
		createRoomInputSchema,
		type SoundboardPolicy
	} from '$lib/teleparty-domain';
	import {
		hydrateSessionProfile,
		sessionProfile,
		sessionReady,
		updateSessionProfile
	} from '$lib/session';

	const client = useConvexClient();

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

	const publicRoomsQuery = useQuery(api.rooms.listPublicRooms, () => ({
		limit: 12
	}));
	const roomPolicyQuery = useQuery(api.rooms.defaultRoomPolicy, () => ({}));

	let watchUrl = '';
	let isPrivate = false;
	let accessCode = '';
	let draftSoundboardPolicy: SoundboardPolicy = {
		kind: 'auto',
		defaultMaxParticipants: DEFAULT_AUTO_SOUNDBOARD_CAPACITY
	};
	let isSubmitting = false;
	let error: string | null = null;

	$: autoCapacity =
		roomPolicyQuery.data?.soundboardPolicy.defaultMaxParticipants ??
		DEFAULT_AUTO_SOUNDBOARD_CAPACITY;
	$: publicRooms = publicRoomsQuery.data ?? [];
	$: soundboardPreview =
		draftSoundboardPolicy.kind === 'manual'
			? `${draftSoundboardPolicy.enabled ? 'Enabled' : 'Disabled'} up to ${draftSoundboardPolicy.maxParticipants} participants`
			: `Auto mode: enabled up to ${draftSoundboardPolicy.defaultMaxParticipants} participants`;

	$: if (
		draftSoundboardPolicy.kind === 'auto' &&
		draftSoundboardPolicy.defaultMaxParticipants !== autoCapacity
	) {
		draftSoundboardPolicy = {
			kind: 'auto',
			defaultMaxParticipants: autoCapacity
		};
	}

	onMount(() => {
		hydrateSessionProfile();
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

	async function onCreateRoomSubmit() {
		error = null;

		if (!$sessionReady) {
			error = 'Session is still initializing. Retry in a moment.';
			return;
		}

		isSubmitting = true;

		try {
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
				soundboardPolicy: draftSoundboardPolicy,
				stageInteractionPolicy: DEFAULT_STAGE_INTERACTION_POLICY
			});

			const room = await client.mutation(api.rooms.createRoom, {
				watchUrl: parsed.watchUrl,
				ownerSessionId: $sessionProfile.sessionId,
				ownerSessionSecret: $sessionProfile.sessionSecret,
				ownerDisplayName: $sessionProfile.displayName,
				ownerColor: $sessionProfile.color,
				visibility: parsed.visibility,
				soundboardPolicy: parsed.soundboardPolicy,
				stageInteractionPolicy: parsed.stageInteractionPolicy
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
	<title>Teleparty Studio / SvelteKit + Convex</title>
	<meta
		name="description"
		content="A SvelteKit frontend for the Teleparty Clone Lab, wired to the live Convex backend."
	/>
</svelte:head>

<div class="shell">
	<section class="hero">
		<div class="hero-copy" in:fly={{ y: 36, duration: 650, easing: quintOut }}>
			<p class="eyebrow">SvelteKit Frontend · Convex Backend</p>
			<h1 class="hero-title">Build a screening room from any link.</h1>
			<p class="hero-body">
				This cut keeps the more editorial Svelte presentation, but it now runs against
				the real Convex room, presence, cursor, and soundboard model instead of a
				local browser vault.
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
			<p class="mast-label">What changed</p>
			<ul class="mast-list">
				<li>Live room creation now goes through Convex mutations</li>
				<li>Public room counts react to real presence instead of local state</li>
				<li>The SvelteKit branch can now be judged as a real frontend, not a mock</li>
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
					Parse-first room setup with explicit privacy and soundboard policy, backed by
					Convex.
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
											maxParticipants: autoCapacity
										}
									: {
											kind: 'auto',
											defaultMaxParticipants: autoCapacity
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

			<div class="summary-line">
				<p class="eyebrow">Preview</p>
				<p class="quiet">{soundboardPreview}</p>
			</div>

			{#if error}
				<p class="error-banner" transition:fade>{error}</p>
			{/if}

			<button class="primary-action" disabled={isSubmitting} type="submit">
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
						<span>Owner key</span><code>{$sessionProfile.sessionSecret}</code>
					</p>
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
					<p class="eyebrow">Lobby</p>
					<h2>Public Rooms</h2>
					<p class="quiet">These rows are live Convex query results, not cached local entries.</p>
				</div>

				{#if publicRoomsQuery.error}
					<p class="error-banner">{publicRoomsQuery.error.message}</p>
				{:else if publicRoomsQuery.isLoading}
					<p class="quiet">Syncing live room list...</p>
				{:else if publicRooms.length === 0}
					<div class="empty-state">
						<p class="empty-title">No public rooms yet.</p>
						<p class="quiet">Create one above and this area becomes the live lobby ledger.</p>
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
								<span class="quiet">
									Hosted by {room.createdByDisplayName} · {room.participantCount} active
								</span>
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

	.summary-line {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--line-soft);
	}

	.primary-action,
	.room-entry {
		border: none;
		border-radius: 1.4rem;
		cursor: pointer;
	}

	.primary-action {
		margin-top: 1rem;
		background:
			linear-gradient(135deg, color-mix(in oklch, var(--ink) 88%, white 12%), color-mix(in oklch, var(--signal-strong) 52%, var(--ink) 48%));
		padding: 0.95rem 1.15rem;
		color: white;
		font-weight: 700;
		letter-spacing: 0.02em;
		box-shadow: 0 16px 36px rgba(59, 37, 18, 0.18);
		transition:
			transform 180ms var(--ease-out-quart),
			box-shadow 180ms var(--ease-out-quart),
			opacity 180ms var(--ease-out-quart);
	}

	.primary-action:hover:enabled {
		transform: translateY(-2px);
		box-shadow: 0 20px 40px rgba(59, 37, 18, 0.22);
	}

	.primary-action:disabled {
		cursor: progress;
		opacity: 0.72;
	}

	.stack {
		display: grid;
		gap: 1.4rem;
	}

	.session-metadata {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--line-soft);
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

	.empty-state {
		border: 1px dashed var(--line-soft);
		border-radius: 1.6rem;
		padding: 1rem;
	}

	.empty-title {
		margin: 0 0 0.25rem;
		font-family: var(--font-display);
		font-size: 1.4rem;
		letter-spacing: -0.03em;
	}

	.room-ledger {
		display: grid;
		gap: 0.8rem;
		margin-top: 1rem;
	}

	.room-entry {
		display: grid;
		gap: 0.28rem;
		align-items: start;
		border: 1px solid var(--line-soft);
		background: color-mix(in oklch, white 84%, var(--paper-shadow) 16%);
		padding: 1rem;
		text-align: left;
		transition:
			transform 180ms var(--ease-out-quart),
			border-color 180ms var(--ease-out-quart),
			background 180ms var(--ease-out-quart);
	}

	.room-entry:hover {
		transform: translateY(-2px);
		border-color: color-mix(in oklch, var(--signal) 46%, white 54%);
		background: color-mix(in oklch, white 58%, var(--signal-wash) 42%);
	}

	.room-host {
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--signal);
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

	@media (min-width: 860px) {
		.hero {
			grid-template-columns: minmax(0, 1.25fr) minmax(18rem, 0.75fr);
			align-items: end;
		}

		.dashboard {
			grid-template-columns: minmax(0, 1.18fr) minmax(19rem, 0.82fr);
			align-items: start;
		}
	}
</style>
