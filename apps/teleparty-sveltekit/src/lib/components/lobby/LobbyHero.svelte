<script lang="ts">
	import { quintOut } from 'svelte/easing';
	import { fade, fly, scale } from 'svelte/transition';
	import { reducedMotion } from '$lib/reduced-motion';

	type CinematicPreset = {
		label: string;
		url: string;
	};

	type LobbyHeroProps = {
		onPresetSelect: (url: string) => void;
		presets: CinematicPreset[];
	};

	let { onPresetSelect, presets }: LobbyHeroProps = $props();
	let flyTransition = $derived(
		$reducedMotion ? { y: 0, duration: 0 } : { y: 36, duration: 650, easing: quintOut }
	);
	let fadeTransition = $derived($reducedMotion ? { duration: 0 } : { delay: 180, duration: 600 });
	let scaleTransition = $derived(
		$reducedMotion
			? { duration: 0, start: 1 }
			: { duration: 420, easing: quintOut, start: 0.92 }
	);
</script>

<section class="lobby-hero">
	<div class="panel hero-panel" in:fly={flyTransition}>
		<p class="eyebrow">Live Screening Desk</p>
		<h1 class="hero-title">Set the room. Then let the session breathe.</h1>
		<p class="hero-body">
			Start from a link, shape the room rules once, then move between watching,
			pointing, and crowd cues without the interface devolving into tooling.
		</p>
		<div class="preset-strip">
			{#each presets as preset, index (preset.label)}
				<button
					class="button-chip"
					in:scale={{ ...scaleTransition, delay: $reducedMotion ? 0 : 120 + index * 70 }}
					onclick={() => onPresetSelect(preset.url)}
					type="button"
				>
					{preset.label}
				</button>
			{/each}
		</div>
	</div>

	<aside class="hero-notes" in:fade={fadeTransition}>
		<p class="eyebrow">Desk Notes</p>
		<div class="hero-note-list">
			<div class="hero-note">
				<strong>Link first, policy second.</strong>
				<p class="quiet">The room starts from the film, then privacy and sound controls fall into place around it.</p>
			</div>
			<div class="hero-note">
				<strong>Presence should feel live, not technical.</strong>
				<p class="quiet">Cursors, sound cues, and participants stay visible without turning the page into a debugger.</p>
			</div>
			<div class="hero-note">
				<strong>Hosts tighten only what needs tightening.</strong>
				<p class="quiet">When the room gets noisy, stage and sound permissions stay one move away instead of buried in settings sprawl.</p>
			</div>
		</div>
	</aside>
</section>
