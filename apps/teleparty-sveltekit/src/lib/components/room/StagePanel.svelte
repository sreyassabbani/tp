<script lang="ts">
	import StageCursor from '$lib/components/StageCursor.svelte';
	import { getRelativeCursorPosition } from '$lib/cursor-stage';
	import { reducedMotion } from '$lib/reduced-motion';
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
	let stageBounds = $state<DOMRectReadOnly | null>(null);

	function syncStageBounds() {
		if (!stageSurface) {
			return;
		}

		stageBounds = stageSurface.getBoundingClientRect();
	}

	function handlePointerMove(event: PointerEvent) {
		if (!stageBounds || stageIsInteractive) {
			return;
		}

		const position = getRelativeCursorPosition(stageBounds, event);
		if (position) {
			onCursorMove(position);
		}
	}

	function handlePointerEnter() {
		syncStageBounds();
	}

	$effect(() => {
		if (!stageSurface) {
			return;
		}

		syncStageBounds();

		const resizeObserver = new ResizeObserver(() => {
			syncStageBounds();
		});

		let frame = 0;
		const onScrollOrResize = () => {
			if (frame !== 0) {
				return;
			}

			frame = window.requestAnimationFrame(() => {
				frame = 0;
				syncStageBounds();
			});
		};

		resizeObserver.observe(stageSurface);
		window.addEventListener('resize', onScrollOrResize);
		window.addEventListener('scroll', onScrollOrResize, true);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', onScrollOrResize);
			window.removeEventListener('scroll', onScrollOrResize, true);
			if (frame !== 0) {
				window.cancelAnimationFrame(frame);
			}
		};
	});
</script>

<section class="panel stage-panel">
	<div class="stage-header">
		<div class="panel-header">
			<p class="eyebrow">Shared stage</p>
			<h2 class="panel-title">Stage controls live where the film lives.</h2>
			<p class="quiet">
				Use cursor mode for shared attention and switch to interact only when you need direct
				player control.
			</p>
		</div>
		<div aria-label="Stage mode" class="stage-modes" role="group">
			<button
				aria-pressed={stageMode === 'cursor'}
				class:active={stageMode === 'cursor'}
				class="stage-mode"
				onclick={() => onStageModeChange('cursor')}
				type="button"
			>
				Cursor
			</button>
			<button
				aria-pressed={stageMode === 'interact'}
				class:active={stageMode === 'interact'}
				class="stage-mode"
				disabled={!canUseStageInteraction}
				onclick={() => onStageModeChange('interact')}
				type="button"
			>
				Interact
			</button>
		</div>
	</div>

	<p class="quiet stage-status">{stageStatusMessage}</p>

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
				onpointerenter={handlePointerEnter}
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
