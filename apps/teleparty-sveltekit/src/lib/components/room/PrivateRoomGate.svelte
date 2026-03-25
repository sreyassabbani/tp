<script lang="ts">
	import { fade } from 'svelte/transition';

	type PrivateRoomGateProps = {
		onJoin: (accessCode: string) => void;
		roomCode: string;
	};

	let { onJoin, roomCode }: PrivateRoomGateProps = $props();

	let accessCode = $state('');
	let hasAttemptedJoin = $state(false);

	function handleSubmit() {
		hasAttemptedJoin = true;
		onJoin(accessCode);
	}

	function handleFormSubmit(event: SubmitEvent) {
		event.preventDefault();
		handleSubmit();
	}
</script>

<div class="shell room-shell">
	<section class="panel private-panel" in:fade={{ duration: 220 }}>
		<p class="eyebrow">Private room</p>
		<h1>Enter the access code for room {roomCode}.</h1>
		<p class="quiet">Convex checks the gate server-side before the room subscription opens.</p>
		<form class="private-form" onsubmit={handleFormSubmit}>
			<label class="field">
				<span class="field-label">Access code</span>
				<input
					bind:value={accessCode}
					class="field-input"
					maxlength="16"
					placeholder="midnight-cut"
					type="text"
				/>
			</label>
			{#if hasAttemptedJoin}
				<p class="error-banner">That access code does not match this room.</p>
			{/if}
			<button class="button-primary join-button" type="submit">Join Room</button>
		</form>
	</section>
</div>

<style>
	.room-shell {
		padding-bottom: 3rem;
	}

	.private-panel {
		display: grid;
		gap: 0.65rem;
		max-width: 42rem;
		padding: 1.6rem;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2.8rem, 8vw, 4.8rem);
		line-height: 0.98;
		letter-spacing: -0.045em;
	}

	.private-form {
		display: grid;
		gap: 1rem;
		margin-top: 0.8rem;
	}

	.join-button {
		width: fit-content;
	}
</style>
