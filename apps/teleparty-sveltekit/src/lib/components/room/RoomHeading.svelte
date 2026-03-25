<script lang="ts">
	import type { RoomViewModel } from '$lib/view-models';

	type RoomHeadingProps = {
		onlineParticipantCount: number;
		room: RoomViewModel;
		soundboardEnabled: boolean;
	};

	let { onlineParticipantCount, room, soundboardEnabled }: RoomHeadingProps = $props();
</script>

<section class="room-hero">
	<div class="room-hero-copy">
		<p class="eyebrow">Live Screening Room</p>
		<h1 class="room-hero-title">Room {room.roomCode}</h1>
		<p class="quiet">
			Watching {room.watchHost} with {onlineParticipantCount} active participant{onlineParticipantCount === 1
				? ''
				: 's'}, hosted by {room.createdByDisplayName}.
		</p>
	</div>

	<div class="room-hero-actions">
		<span class="pill" data-tone="muted">{room.visibility.kind}</span>
		<span class="pill" data-tone={soundboardEnabled ? 'success' : 'muted'}>
			{soundboardEnabled ? 'soundboard live' : 'soundboard gated'}
		</span>
		<a class="button-secondary" href={room.watchUrl} rel="noreferrer" target="_blank">
			Open watch link
		</a>
	</div>
</section>
