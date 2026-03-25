<script lang="ts">
	import { fade } from 'svelte/transition';
	import { reducedMotion } from '$lib/reduced-motion';

	type PrivateRoomGateProps = {
		onJoin: (accessCode: string) => void;
		roomCode: string;
	};

	let { onJoin, roomCode }: PrivateRoomGateProps = $props();

	let accessCode = $state('');
	let hasAttemptedJoin = $state(false);
	const feedbackId = 'private-room-gate-feedback';

	function handleSubmit() {
		hasAttemptedJoin = true;
		onJoin(accessCode);
	}

	function handleFormSubmit(event: SubmitEvent) {
		event.preventDefault();
		handleSubmit();
	}

	let fadeTransition = $derived($reducedMotion ? { duration: 0 } : { duration: 220 });
</script>

<main class="shell room-shell">
	<section aria-describedby={hasAttemptedJoin ? feedbackId : undefined} class="panel private-panel" in:fade={fadeTransition}>
		<p class="eyebrow">Private room</p>
		<h1>Enter the access code for room {roomCode}.</h1>
		<p class="quiet">Use the host’s access phrase to open the room.</p>
		<form class="private-form" onsubmit={handleFormSubmit}>
			<label class="field">
				<span class="field-label">Access code</span>
				<input
					aria-describedby={hasAttemptedJoin ? feedbackId : undefined}
					aria-invalid={hasAttemptedJoin ? 'true' : undefined}
					bind:value={accessCode}
					class="field-input"
					maxlength="16"
					placeholder="midnight-cut"
					required
					type="text"
				/>
			</label>
			{#if hasAttemptedJoin}
				<p aria-live="polite" class="error-banner" id={feedbackId} role="alert">
					That access phrase does not match this room.
				</p>
			{/if}
			<button class="button-primary join-button" type="submit">Join Room</button>
		</form>
	</section>
</main>

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
