<script lang="ts">
	import { quintOut } from 'svelte/easing';
	import { fade, fly, scale } from 'svelte/transition';

	type CinematicPreset = {
		label: string;
		url: string;
	};

	type LobbyHeroProps = {
		onPresetSelect: (url: string) => void;
		presets: CinematicPreset[];
	};

	let { onPresetSelect, presets }: LobbyHeroProps = $props();
</script>

<section class="hero">
	<div class="hero-copy" in:fly={{ y: 36, duration: 650, easing: quintOut }}>
		<p class="eyebrow">SvelteKit Frontend · Convex Backend</p>
		<h1 class="hero-title">Build a screening room from any link.</h1>
		<p class="hero-body">
			This branch should feel like a deliberate product surface, not a framework demo.
			Everything here is tuned for live room hosting: clear cadence, warm materials, and
			realtime state that still reads like a designed interface.
		</p>
		<div class="preset-strip">
			{#each presets as preset, index (preset.label)}
				<button
					class="button-chip"
					in:scale={{ delay: 120 + index * 70, duration: 420, easing: quintOut, start: 0.92 }}
					onclick={() => onPresetSelect(preset.url)}
					type="button"
				>
					{preset.label}
				</button>
			{/each}
		</div>
	</div>

	<aside class="hero-ledger panel" in:fade={{ delay: 180, duration: 600 }}>
		<p class="ledger-title">Cut notes</p>
		<div class="ledger-grid">
			<div>
				<strong>Realtime room model</strong>
				<p>Lobby counts, room joins, cursors, and soundboard traffic all come from Convex.</p>
			</div>
			<div>
				<strong>Svelte 5 shape</strong>
				<p>Runes, `$app/state`, and extracted panels replace the legacy one-file route pass.</p>
			</div>
			<div>
				<strong>Editorial bias</strong>
				<p>Warm paper outside, stage contrast inside, and a control-desk rhythm instead of generic cards.</p>
			</div>
		</div>
	</aside>
</section>

<style>
	.hero {
		display: grid;
		gap: 1.5rem;
		margin-bottom: 1.8rem;
	}

	.hero-copy {
		max-width: 50rem;
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
		max-width: 39rem;
		color: var(--ink-soft);
		font-size: 1.05rem;
		line-height: 1.72;
	}

	.preset-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-top: 1.6rem;
	}

	.hero-ledger {
		align-self: end;
		padding: 1.3rem;
	}

	.ledger-title {
		margin: 0;
		color: var(--signal);
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.ledger-grid {
		display: grid;
		gap: 0.9rem;
		margin-top: 1rem;
	}

	.ledger-grid div {
		display: grid;
		gap: 0.2rem;
	}

	.ledger-grid strong {
		font-size: 0.96rem;
		letter-spacing: -0.02em;
	}

	.ledger-grid p {
		margin: 0;
		color: var(--ink-soft);
		line-height: 1.6;
	}

	@media (min-width: 860px) {
		.hero {
			grid-template-columns: minmax(0, 1.25fr) minmax(20rem, 0.75fr);
			align-items: end;
		}
	}
</style>
