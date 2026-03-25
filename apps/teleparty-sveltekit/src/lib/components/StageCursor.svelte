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
				<defs>
					<mask id="rounded-pointer-mask">
						<rect width="28" height="28" fill="black"></rect>
						<path
							d="M10.2 4.2C11.5 3.5 13.1 3.6 14.3 4.5L21.1 10C22.4 11 22.8 12.7 22.2 14.2L17.8 23C17 24.6 15.1 25.4 13.5 24.8L6.4 21.8C4.7 21.1 3.7 19.3 3.9 17.5L5.1 8.7C5.3 7.1 6.2 5.7 7.5 5L10.2 4.2Z"
							fill="white"
						></path>
						<circle cx="10.4" cy="15.6" r="3.2" fill="black"></circle>
					</mask>
				</defs>
				<path
					d="M10.2 4.2C11.5 3.5 13.1 3.6 14.3 4.5L21.1 10C22.4 11 22.8 12.7 22.2 14.2L17.8 23C17 24.6 15.1 25.4 13.5 24.8L6.4 21.8C4.7 21.1 3.7 19.3 3.9 17.5L5.1 8.7C5.3 7.1 6.2 5.7 7.5 5L10.2 4.2Z"
					fill={color}
					mask="url(#rounded-pointer-mask)"
					stroke="var(--cursor-highlight-fill)"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.2"
				></path>
				<path
					d="M14.2 8.4C15.3 7.9 16.6 8.3 17.2 9.2C17.8 10.2 17.5 11.5 16.5 12.2C15.4 12.9 14 12.6 13.3 11.6C12.6 10.4 12.9 9 14.2 8.4Z"
					fill="color-mix(in oklch, white 30%, transparent 70%)"
					stroke="var(--cursor-highlight-stroke)"
					stroke-width="0.75"
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
		gap: 0.5rem;
		border-radius: 999px;
		border: 1px solid color-mix(in oklch, white 64%, var(--cursor-color) 36%);
		background:
			linear-gradient(135deg, color-mix(in oklch, white 92%, var(--cursor-color) 8%), color-mix(in oklch, white 82%, var(--cursor-color) 18%));
		padding: 0.28rem 0.7rem 0.28rem 0.38rem;
		box-shadow: var(--cursor-shell-shadow);
		color: oklch(22% 0.03 34);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		backdrop-filter: blur(12px);
	}

	.cursor-chip.solo {
		transform: translateY(-2px);
	}

	.cursor-glyph {
		display: inline-flex;
		height: 1rem;
		width: 1rem;
		flex: none;
	}

	.cursor-glyph svg {
		display: block;
		height: 100%;
		width: 100%;
		filter: drop-shadow(0 4px 10px rgba(62, 37, 18, 0.18));
	}

	.cursor-name {
		max-width: 12ch;
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
