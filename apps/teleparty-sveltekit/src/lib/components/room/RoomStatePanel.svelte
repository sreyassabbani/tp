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

<main class="shell notice-shell">
	<section class="panel notice-card state-panel">
		<p class="eyebrow">{eyebrow}</p>
		<h1 class="notice-title">{title}</h1>
		<p class="quiet">{body}</p>
		{#if actionLabel && onAction}
			<button class="button-secondary state-action" onclick={onAction} type="button">
				{actionLabel}
			</button>
		{/if}
	</section>
</main>
