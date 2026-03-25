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

<section class="hero">
	<div class="hero-copy" in:fly={flyTransition}>
		<p class="eyebrow">Live Screening Desk</p>
		<h1 class="hero-title">Start a room from any watch link.</h1>
		<p class="hero-body">
			Set up a shared room, tune the crowd controls, and move between cinematic viewing
			and live cursor mode without the interface collapsing into admin chrome.
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

	<aside class="hero-ledger" in:fade={fadeTransition}>
		<p class="ledger-title">How It Runs</p>
		<div class="ledger-grid">
			<div>
				<strong>Room-first flow</strong>
				<p>Start with the link, set the room rules, then let the rest of the controls fall in behind it.</p>
			</div>
			<div>
				<strong>Shared presence</strong>
				<p>Participants, cursors, and sound cues stay live without turning the surface into a debug console.</p>
			</div>
			<div>
				<strong>Owner controls</strong>
				<p>When the room gets noisy, the host can tighten soundboard and stage access without leaving the session.</p>
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
		padding: 0.35rem 0 0 1.2rem;
		border-left: 1px solid var(--panel-rule);
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

	@media (max-width: 859px) {
		.hero-ledger {
			padding: 1.15rem 0 0;
			border-left: 0;
			border-top: 1px solid var(--panel-rule);
		}
	}
</style>
