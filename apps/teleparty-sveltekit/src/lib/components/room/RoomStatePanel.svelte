<script lang="ts">
	type RoomStatePanelProps = {
		actionLabel?: string;
		body: string;
		eyebrow: string;
		onAction?: () => void;
		title: string;
	};

	let { actionLabel, body, eyebrow, onAction, title }: RoomStatePanelProps = $props();
</script>

<div class="shell room-shell">
	<section class="panel state-panel">
		<p class="eyebrow">{eyebrow}</p>
		<h1>{title}</h1>
		<p class="quiet">{body}</p>
		{#if actionLabel && onAction}
			<button class="button-secondary state-action" onclick={onAction} type="button">
				{actionLabel}
			</button>
		{/if}
	</section>
</div>

<style>
	.room-shell {
		padding-bottom: 3rem;
	}

	.state-panel {
		display: grid;
		gap: 0.65rem;
		max-width: 42rem;
		padding: 1.6rem;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2.8rem, 8vw, 4.8rem);
		line-height: 0.98;
		letter-spacing: -0.045em;
	}

	.state-action {
		margin-top: 0.65rem;
		width: fit-content;
	}
</style>
