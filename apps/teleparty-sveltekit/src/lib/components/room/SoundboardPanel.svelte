<script lang="ts">
	import { sounds } from '$lib/soundboard';
	import type { SoundEventViewModel } from '$lib/view-models';

	type SoundboardPanelProps = {
		error: string | null;
		events: SoundEventViewModel[];
		onTrigger: (soundId: (typeof sounds)[number]['id']) => Promise<void> | void;
		soundboardEnabled: boolean;
	};

	let { error, events, onTrigger, soundboardEnabled }: SoundboardPanelProps = $props();
	const soundLabels = new Map(sounds.map((sound) => [sound.id, sound.label]));
</script>

<section class="panel soundboard-panel">
	<div class="panel-header">
		<p class="eyebrow">Dock</p>
		<h2 class="panel-title">Soundboard</h2>
		<p class="quiet">Short cues the room can hear together when the host allows it.</p>
	</div>

	<div class="sound-grid">
		{#each sounds as sound}
			<button
				class="sound-button"
				disabled={!soundboardEnabled}
				onclick={() => onTrigger(sound.id)}
				type="button"
			>
				{sound.label}
			</button>
		{/each}
	</div>

	{#if error}
		<p class="error-banner panel-error">{error}</p>
	{/if}

	<div class="event-log">
		<p class="eyebrow">Recent sounds</p>
		{#if events.length === 0}
			<p class="quiet">Still quiet. Hit a sting and the ledger updates.</p>
		{:else}
			<div aria-live="polite" class="log-stack">
				{#each events.slice(-6) as event (event.eventId)}
					<p>{event.actorDisplayName} played {soundLabels.get(event.soundId) ?? 'a cue'}</p>
				{/each}
			</div>
		{/if}
	</div>
</section>

<style>
	.soundboard-panel {
		padding: 1.25rem;
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
		background: var(--surface-strong);
		padding: 0.9rem;
		cursor: pointer;
		font-weight: 700;
		letter-spacing: 0.02em;
		transition:
			transform 160ms var(--ease-out-quart),
			border-color 160ms var(--ease-out-quart),
			background 160ms var(--ease-out-quart),
			opacity 160ms var(--ease-out-quart);
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

	.panel-error,
	.event-log {
		margin-top: 1rem;
	}

	.event-log {
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
</style>
