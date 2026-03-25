<script lang="ts">
	import type { RoomViewModel } from '$lib/view-models';

	type RoomHeadingProps = {
		onlineParticipantCount: number;
		room: RoomViewModel;
		soundboardEnabled: boolean;
	};

	let { onlineParticipantCount, room, soundboardEnabled }: RoomHeadingProps = $props();
</script>

<section class="room-heading">
	<div class="heading-copy">
		<p class="eyebrow">SvelteKit frontend · Convex room</p>
		<h1>Room {room.roomCode}</h1>
		<p class="quiet">
			Owner: {room.createdByDisplayName} · {onlineParticipantCount} active participant{onlineParticipantCount === 1
				? ''
				: 's'}
		</p>
	</div>

	<div class="heading-actions">
		<span class="pill">{room.visibility.kind}</span>
		<span class="pill" class:muted={!soundboardEnabled}>
			{soundboardEnabled ? 'soundboard live' : 'soundboard gated'}
		</span>
		<a class="button-secondary" href={room.watchUrl} rel="noreferrer" target="_blank">
			Open watch link
		</a>
	</div>
</section>

<style>
	.room-heading {
		display: grid;
		gap: 1rem;
		margin-bottom: 1.35rem;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2.8rem, 7vw, 5rem);
		line-height: 0.98;
		letter-spacing: -0.045em;
	}

	.heading-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
	}

	.muted {
		color: var(--ink-soft);
	}
</style>
