<script lang="ts">
	import type { PublicRoomSummary } from '$lib/view-models';
	import { quintOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { reducedMotion } from '$lib/reduced-motion';

	type PublicRoomsPanelProps = {
		error: string | null;
		isLoading: boolean;
		onOpenRoom: (roomCode: string) => void;
		rooms: PublicRoomSummary[];
	};

	let { error, isLoading, onOpenRoom, rooms }: PublicRoomsPanelProps = $props();
	let flyTransition = $derived(
		$reducedMotion ? { x: 0, duration: 0 } : { x: 18, duration: 420, easing: quintOut }
	);
</script>

<section class="panel rooms-panel">
	<div class="panel-header">
		<p class="eyebrow">Lobby</p>
		<h2 class="panel-title">Public Rooms</h2>
		<p class="quiet">Fresh rooms you can actually step into right now.</p>
	</div>

	{#if error}
		<p class="error-banner panel-error">{error}</p>
	{:else if isLoading}
		<p class="quiet panel-copy">Syncing live room list...</p>
	{:else if rooms.length === 0}
		<div class="empty-state panel-copy">
			<p class="empty-title">No public rooms yet.</p>
			<p class="quiet">Create one above and the lobby becomes a live list instead of an empty desk.</p>
		</div>
	{:else}
		<div class="room-ledger">
			{#each rooms as room, index (room.roomCode)}
				<button
					class="room-entry"
					in:fly={{ ...flyTransition, delay: $reducedMotion ? 0 : 120 + index * 60 }}
					onclick={() => onOpenRoom(room.roomCode)}
					type="button"
				>
					<div class="room-entry-top">
						<span class="room-host">{room.watchHost}</span>
						<span class="pill" data-tone="accent">{room.participantCount} live</span>
					</div>
					<div class="room-entry-title">
						<strong>Room {room.roomCode}</strong>
						<span class="pill" data-tone={room.soundboardPolicy.kind === 'manual' ? 'muted' : 'success'}>
							{room.soundboardPolicy.kind === 'manual' ? 'manual soundboard' : 'auto soundboard'}
						</span>
					</div>
					<p class="quiet">
						Hosted by {room.createdByDisplayName}
					</p>
				</button>
			{/each}
		</div>
	{/if}
</section>
