<script lang="ts">
	type CursorViewModel = {
		color: string;
		displayName: string;
		isSelf?: boolean;
		x: number;
		y: number;
	};

	let { color, displayName, isSelf = false, x, y }: CursorViewModel = $props();
</script>

<div class="cursor-shell" style={`left: ${x}%; top: ${y}%; z-index: ${isSelf ? 30 : 20};`}>
	<div class:solo={isSelf} class="cursor-chip" style={`--cursor-color: ${color};`}>
		<span class="cursor-glyph" aria-hidden="true">
			<svg viewBox="0 0 28 28" fill="none">
				<path
					d="M5.2 4.4C4.5 4.1 3.9 4.7 4.1 5.4L8.1 22.2C8.4 23.5 10 23.9 10.9 23L14.2 19.7C14.6 19.3 15.2 19.3 15.6 19.7L18.8 22.9C19.6 23.7 20.9 23.7 21.7 22.9C22.5 22.1 22.5 20.8 21.7 20L18.4 16.8C18 16.4 18 15.8 18.4 15.4L21.6 12.2C22.5 11.3 22.1 9.8 20.8 9.5L5.2 4.4Z"
					fill={color}
					stroke="var(--cursor-highlight-fill)"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.2"
				></path>
				<path
					d="M10.7 7.8C10.2 7.5 9.7 7.9 9.8 8.5L11.8 16.2C11.9 16.8 12.7 16.9 13 16.5L14.6 14.6C14.9 14.3 15.3 14.3 15.6 14.6L17.2 16.2"
					fill="color-mix(in oklch, white 30%, transparent 70%)"
					stroke="var(--cursor-highlight-stroke)"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1"
				></path>
			</svg>
		</span>
		<span class="cursor-name">{displayName}</span>
		{#if isSelf}
			<span class="cursor-self">you</span>
		{/if}
	</div>
</div>

<style>
	.cursor-shell {
		position: absolute;
		pointer-events: none;
		transform: translate(-50%, -50%);
	}

	.cursor-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.38rem;
		border-radius: 999px;
		border: 1px solid color-mix(in oklch, white 72%, var(--cursor-color) 28%);
		background:
			linear-gradient(135deg, color-mix(in oklch, white 94%, var(--cursor-color) 6%), color-mix(in oklch, white 86%, var(--cursor-color) 14%));
		padding: 0.22rem 0.58rem 0.22rem 0.3rem;
		box-shadow: var(--cursor-shell-shadow);
		color: oklch(22% 0.03 34);
		font-size: 0.69rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.cursor-chip.solo {
		transform: translateY(-2px);
	}

	.cursor-glyph {
		display: inline-flex;
		height: 0.92rem;
		width: 0.92rem;
		flex: none;
	}

	.cursor-glyph svg {
		display: block;
		height: 100%;
		width: 100%;
		filter: drop-shadow(0 4px 10px rgba(62, 37, 18, 0.18));
	}

	.cursor-name {
		max-width: 11ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cursor-self {
		color: oklch(43% 0.08 20);
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
</style>
