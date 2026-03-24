<script lang="ts">
	import type { DrawingStroke, StagePoint } from '$lib/rooms';

	type PreviewStroke = {
		color: string;
		points: StagePoint[];
	} | null;

	let {
		strokes,
		previewStroke = null
	}: {
		strokes: DrawingStroke[];
		previewStroke?: PreviewStroke;
	} = $props();

	function toPointString(points: StagePoint[]): string {
		return points.map((point) => `${point.x * 100},${point.y * 100}`).join(' ');
	}
</script>

<svg aria-hidden="true" class="drawing-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
	{#each strokes as stroke (stroke.strokeId)}
		<polyline
			fill="none"
			points={toPointString(stroke.points)}
			stroke="rgba(255, 255, 255, 0.7)"
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2.4"
		/>
		<polyline
			fill="none"
			points={toPointString(stroke.points)}
			stroke={stroke.color}
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.45"
		/>
	{/each}

	{#if previewStroke}
		<polyline
			fill="none"
			points={toPointString(previewStroke.points)}
			stroke="rgba(255, 255, 255, 0.75)"
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2.4"
			stroke-dasharray="0 0"
		/>
		<polyline
			fill="none"
			points={toPointString(previewStroke.points)}
			stroke={previewStroke.color}
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.45"
			stroke-dasharray="0 0"
		/>
	{/if}
</svg>

<style>
	.drawing-layer {
		position: absolute;
		inset: 0.65rem;
		height: calc(100% - 1.3rem);
		width: calc(100% - 1.3rem);
		pointer-events: none;
		overflow: visible;
	}
</style>
