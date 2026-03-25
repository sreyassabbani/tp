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
	const soundLabels = new Map<string, string>(sounds.map((sound) => [sound.id, sound.label]));
</script>

<section class="panel soundboard-panel">
	<div class="panel-header">
		<p class="eyebrow">Dock</p>
		<h2 class="panel-title">Soundboard</h2>
		<p class="quiet">Short cues the room can hear together when the host allows it.</p>
	</div>

	<div class="status-row">
		<span class="pill" data-tone={soundboardEnabled ? 'success' : 'muted'}>
			{soundboardEnabled ? 'cues available' : 'host gated'}
		</span>
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
