<script lang="ts">
	import StageCursor from '$lib/components/StageCursor.svelte';
	import { getRelativeCursorPosition } from '$lib/cursor-stage';
	import type { CursorViewModel } from '$lib/view-models';

	type StageMode = 'cursor' | 'interact';

	type StagePanelProps = {
		canUseStageInteraction: boolean;
		cursors: CursorViewModel[];
		onCursorMove: (position: { x: number; y: number }) => void;
		onPointerLeave: () => void;
		onStageModeChange: (mode: StageMode) => void;
		roomCode: string;
		selfSessionId: string;
		stageIsInteractive: boolean;
		stageMode: StageMode;
		stageStatusMessage: string;
		watchFrameUrl: string;
	};

	let {
		canUseStageInteraction,
		cursors,
		onCursorMove,
		onPointerLeave,
		onStageModeChange,
		roomCode,
		selfSessionId,
		stageIsInteractive,
		stageMode,
		stageStatusMessage,
		watchFrameUrl
	}: StagePanelProps = $props();

	let stageSurface: HTMLDivElement | null = null;

	function handlePointerMove(event: PointerEvent) {
		if (!stageSurface || stageIsInteractive) {
			return;
		}

		const position = getRelativeCursorPosition(stageSurface.getBoundingClientRect(), event);
		if (position) {
			onCursorMove(position);
		}
	}
</script>

<section class="panel stage-panel">
	<div class="panel-header stage-header">
		<div>
			<p class="eyebrow">Shared stage</p>
			<h2 class="panel-title">Interact when you click the film, cursor when you annotate the room.</h2>
		</div>
		<div class="stage-modes">
			<button
				class:active={stageMode === 'cursor'}
				onclick={() => onStageModeChange('cursor')}
				type="button"
			>
				Cursor
			</button>
			<button
				class:active={stageMode === 'interact'}
				disabled={!canUseStageInteraction}
				onclick={() => onStageModeChange('interact')}
				type="button"
			>
				Interact
			</button>
		</div>
	</div>

	<p class="quiet stage-copy">{stageStatusMessage}</p>

	<div bind:this={stageSurface} class="stage-frame">
		<div class="frame-glow"></div>
		<iframe
			allowfullscreen
			class:locked={!stageIsInteractive}
			class="stage-iframe"
			referrerpolicy="strict-origin-when-cross-origin"
			src={watchFrameUrl}
			title={`Room ${roomCode} watch frame`}
		></iframe>

		{#if !stageIsInteractive}
			<div
				aria-hidden="true"
				class="cursor-layer"
				onpointerleave={onPointerLeave}
				onpointermove={handlePointerMove}
				role="presentation"
			></div>
		{/if}

		{#each cursors as cursor (cursor.sessionId)}
			<StageCursor
				color={cursor.color}
				displayName={cursor.displayName}
				isSelf={cursor.sessionId === selfSessionId}
				x={cursor.x}
				y={cursor.y}
			/>
		{/each}
	</div>
</section>

<style>
	.stage-panel {
		padding: 1.25rem;
	}

	.stage-header {
		display: grid;
		gap: 1rem;
	}

	.stage-modes {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.4rem;
		border: 1px solid var(--line-soft);
		border-radius: 999px;
		background: var(--surface-strong);
	}

	.stage-modes button {
		border: none;
		border-radius: 999px;
		background: transparent;
		padding: 0.65rem 0.95rem;
		cursor: pointer;
		font-weight: 700;
		letter-spacing: 0.03em;
		transition:
			background 160ms var(--ease-out-quart),
			color 160ms var(--ease-out-quart),
			transform 160ms var(--ease-out-quart),
			opacity 160ms var(--ease-out-quart);
	}

	.stage-modes button.active {
		background:
			linear-gradient(135deg, color-mix(in oklch, var(--ink) 88%, white 12%), color-mix(in oklch, var(--signal-strong) 52%, var(--ink) 48%));
		color: white;
		box-shadow: 0 12px 24px rgba(54, 35, 18, 0.18);
	}

	.stage-modes button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.stage-copy {
		margin-top: 0.8rem;
	}

	.stage-frame {
		position: relative;
		overflow: hidden;
		margin-top: 1rem;
		min-height: 27rem;
		border-radius: 2rem;
		border: 1px solid color-mix(in oklch, var(--signal) 24%, white 76%);
		background:
			radial-gradient(circle at top, color-mix(in oklch, var(--signal-wash) 36%, transparent 64%), transparent 34%),
			linear-gradient(180deg, oklch(21% 0.03 22), oklch(18% 0.02 28));
		box-shadow: var(--shadow-stage);
	}

	.frame-glow {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.15), transparent 24%),
			repeating-linear-gradient(
				90deg,
				rgba(255, 255, 255, 0.04) 0 2px,
				transparent 2px 36px
			);
		pointer-events: none;
	}

	.stage-iframe {
		position: absolute;
		inset: 0.7rem;
		width: calc(100% - 1.4rem);
		height: calc(100% - 1.4rem);
		border: none;
		border-radius: 1.45rem;
		background: oklch(18% 0.02 28);
	}

	.stage-iframe.locked {
		pointer-events: none;
	}

	.cursor-layer {
		position: absolute;
		inset: 0.7rem;
		border-radius: 1.45rem;
		cursor: none;
	}
</style>
