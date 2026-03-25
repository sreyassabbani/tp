<script lang="ts">
	import type { PublicRoomSummary } from '$lib/view-models';
	import { quintOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	type PublicRoomsPanelProps = {
		error: string | null;
		isLoading: boolean;
		onOpenRoom: (roomCode: string) => void;
		rooms: PublicRoomSummary[];
	};

	let { error, isLoading, onOpenRoom, rooms }: PublicRoomsPanelProps = $props();
</script>

<section class="panel rooms-panel">
	<div class="panel-header">
		<p class="eyebrow">Lobby</p>
		<h2 class="panel-title">Public Rooms</h2>
		<p class="quiet">
			Live Convex rows, shaped like a room ledger instead of a generic table.
		</p>
	</div>

	{#if error}
		<p class="error-banner panel-error">{error}</p>
	{:else if isLoading}
		<p class="quiet panel-copy">Syncing live room list...</p>
	{:else if rooms.length === 0}
		<div class="empty-state panel-copy">
			<p class="empty-title">No public rooms yet.</p>
			<p class="quiet">Create one above and this space becomes the live lobby ledger.</p>
		</div>
	{:else}
		<div class="room-ledger">
			{#each rooms as room, index (room.roomCode)}
				<button
					class="room-entry"
					in:fly={{ x: 18, delay: 120 + index * 60, duration: 420, easing: quintOut }}
					onclick={() => onOpenRoom(room.roomCode)}
					type="button"
				>
					<span class="room-host">{room.watchHost}</span>
					<strong>Room {room.roomCode}</strong>
					<span class="quiet">
						Hosted by {room.createdByDisplayName} · {room.participantCount} active
					</span>
				</button>
			{/each}
		</div>
	{/if}
</section>

<style>
	.rooms-panel {
		padding: 1.35rem;
	}

	.panel-error,
	.panel-copy {
		margin-top: 1rem;
	}

	.room-ledger {
		display: grid;
		gap: 0.8rem;
		margin-top: 1rem;
	}

	.room-entry {
		display: grid;
		gap: 0.28rem;
		align-items: start;
		border: 1px solid var(--line-soft);
		border-radius: 1.4rem;
		background: var(--surface-strong);
		padding: 1rem;
		text-align: left;
	}

	.room-entry:hover {
		transform: translateY(-2px);
		border-color: color-mix(in oklch, var(--signal) 46%, white 54%);
		background: color-mix(in oklch, white 58%, var(--signal-wash) 42%);
	}

	.room-host {
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--signal);
	}
</style>
