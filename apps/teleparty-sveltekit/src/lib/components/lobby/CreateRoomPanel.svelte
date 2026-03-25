<script lang="ts">
	import type { SoundboardPolicy, Visibility } from '$lib/teleparty-domain';
	import { fade } from 'svelte/transition';
	import { reducedMotion } from '$lib/reduced-motion';

	type CreateRoomDraft = {
		soundboardPolicy: SoundboardPolicy;
		visibility: Visibility;
		watchUrl: string;
	};

	type SoundboardDraft =
		| {
				kind: 'auto';
				maxParticipants: number;
		  }
		| {
				enabled: boolean;
				kind: 'manual';
				maxParticipants: number;
		  };

	type VisibilityDraft =
		| {
				kind: 'public';
		  }
		| {
				accessCode: string;
				kind: 'private';
		  };

	type CreateRoomPanelProps = {
		autoCapacity: number;
		error: string | null;
		isSubmitting: boolean;
		onCreate: (draft: CreateRoomDraft) => Promise<void> | void;
		watchUrl?: string;
	};

	let {
		autoCapacity,
		error,
		isSubmitting,
		onCreate,
		watchUrl = $bindable('')
	}: CreateRoomPanelProps = $props();

	let soundboardDraft = $state<SoundboardDraft>({
		kind: 'auto',
		maxParticipants: 8
	});
	let visibilityDraft = $state<VisibilityDraft>({ kind: 'public' });
	const feedbackId = 'create-room-feedback';
	const watchUrlId = 'create-room-watch-url';
	const accessCodeId = 'create-room-access-code';

	let soundboardPolicy = $derived.by<SoundboardPolicy>(() =>
		soundboardDraft.kind === 'manual'
			? {
					kind: 'manual',
					enabled: soundboardDraft.enabled,
					maxParticipants: soundboardDraft.maxParticipants
				}
			: {
					kind: 'auto',
					defaultMaxParticipants: soundboardDraft.maxParticipants
				}
	);

	let soundboardPreview = $derived.by(() =>
		soundboardDraft.kind === 'manual'
			? `${soundboardDraft.enabled ? 'Enabled' : 'Disabled'} up to ${soundboardDraft.maxParticipants} participants`
			: `Auto mode: enabled up to ${soundboardDraft.maxParticipants} participants`
	);

	$effect(() => {
		if (soundboardDraft.kind === 'auto' && soundboardDraft.maxParticipants !== autoCapacity) {
			soundboardDraft = {
				kind: 'auto',
				maxParticipants: autoCapacity
			};
		}
	});

	async function handleSubmit() {
		const visibility: Visibility =
			visibilityDraft.kind === 'private'
				? {
						kind: 'private',
						accessCode: visibilityDraft.accessCode
					}
				: { kind: 'public' };

		await onCreate({
			watchUrl,
			visibility,
			soundboardPolicy
		});
	}

	function setPrivateRoom(enabled: boolean) {
		visibilityDraft = enabled
			? {
					kind: 'private',
					accessCode: visibilityDraft.kind === 'private' ? visibilityDraft.accessCode : ''
				}
			: { kind: 'public' };
	}

	function setManualMode(enabled: boolean) {
		soundboardDraft = enabled
			? {
					kind: 'manual',
					enabled: soundboardDraft.kind === 'manual' ? soundboardDraft.enabled : true,
					maxParticipants: soundboardDraft.maxParticipants
				}
			: {
					kind: 'auto',
					maxParticipants: soundboardDraft.maxParticipants
				};
	}

	function handleFormSubmit(event: SubmitEvent) {
		event.preventDefault();
		void handleSubmit();
	}

	let fadeTransition = $derived($reducedMotion ? { duration: 0 } : { duration: 180 });
</script>

<form aria-describedby={error ? feedbackId : undefined} class="panel creation-panel" onsubmit={handleFormSubmit}>
	<div class="panel-header">
		<p class="eyebrow">Studio</p>
		<h2 class="panel-title">Create Room</h2>
		<p class="quiet">
			Parse-first room setup with explicit privacy and owner policy, aimed at a live room
			that still feels composed.
		</p>
	</div>

	<label class="field">
		<span class="field-label">Watch link</span>
		<input
			id={watchUrlId}
			aria-describedby={error ? feedbackId : undefined}
			aria-invalid={error ? 'true' : undefined}
			bind:value={watchUrl}
			class="field-input"
			placeholder="https://www.youtube.com/watch?v=..."
			required
			type="url"
		/>
	</label>

	<div class="switch-card">
		<div>
			<p class="control-title">Private room</p>
			<p class="quiet">Gate the room with an access code when the screening should stay closed.</p>
		</div>
		<label class="switch">
			<input
				checked={visibilityDraft.kind === 'private'}
				onchange={(event) => setPrivateRoom((event.currentTarget as HTMLInputElement).checked)}
				type="checkbox"
			/>
			<span class="switch-track"></span>
		</label>
	</div>

	{#if visibilityDraft.kind === 'private'}
		<label class="field" transition:fade={fadeTransition}>
			<span class="field-label">Access code</span>
			<input
				id={accessCodeId}
				aria-describedby={error ? feedbackId : undefined}
				aria-invalid={error ? 'true' : undefined}
				bind:value={visibilityDraft.accessCode}
				class="field-input"
				maxlength="16"
				placeholder="midnight-cut"
				required={visibilityDraft.kind === 'private'}
				type="text"
			/>
		</label>
	{/if}

	<div class="policy-card">
		<div class="policy-header">
			<div>
				<p class="control-title">Owner-controlled soundboard</p>
				<p class="quiet">Manual mode lets you gate room chaos with an explicit crowd ceiling.</p>
			</div>
			<label class="switch">
				<input
					checked={soundboardDraft.kind === 'manual'}
					onchange={(event) => setManualMode((event.currentTarget as HTMLInputElement).checked)}
					type="checkbox"
				/>
				<span class="switch-track"></span>
			</label>
		</div>

		{#if soundboardDraft.kind === 'manual'}
			<div class="manual-controls" transition:fade={fadeTransition}>
				<label class="checkline">
					<input
						bind:checked={soundboardDraft.enabled}
						type="checkbox"
					/>
					<span>Enable soundboard</span>
				</label>

				<label class="slider-line">
					<span>Max participants</span>
					<strong>{soundboardDraft.maxParticipants}</strong>
					<input bind:value={soundboardDraft.maxParticipants} max="24" min="2" type="range" />
				</label>
			</div>
		{/if}
	</div>

	<div class="summary-line">
		<p class="eyebrow">Preview</p>
		<p class="quiet">{soundboardPreview}</p>
	</div>

	{#if error}
		<p aria-live="polite" class="error-banner" id={feedbackId} role="alert" transition:fade={fadeTransition}>
			{error}
		</p>
	{/if}

	<button class="button-primary submit-button" disabled={isSubmitting} type="submit">
		{isSubmitting ? 'Cutting the room...' : 'Create Room'}
	</button>
</form>

<style>
	.creation-panel {
		display: grid;
		gap: 1rem;
		padding: 1.35rem;
	}

	.switch-card,
	.policy-card {
		border-top: 1px solid var(--panel-rule);
		border-radius: 0;
		background: transparent;
		padding: 1rem 0 0;
	}

	.switch-card,
	.policy-header {
		display: flex;
		gap: 1rem;
		align-items: start;
		justify-content: space-between;
	}

	.control-title {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.manual-controls {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--line-soft);
	}

	.checkline,
	.slider-line {
		display: grid;
		gap: 0.45rem;
	}

	.checkline {
		grid-template-columns: auto 1fr;
		align-items: center;
	}

	.checkline span,
	.slider-line span {
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		text-transform: none;
	}

	.summary-line {
		padding-top: 1rem;
		border-top: 1px solid var(--line-soft);
	}

	.submit-button {
		margin-top: 0.2rem;
	}
</style>
