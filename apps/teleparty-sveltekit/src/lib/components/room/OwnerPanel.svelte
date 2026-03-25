<script lang="ts">
	import type {
		RoomCapability,
		SoundboardPolicy,
		StageInteractionPolicy
	} from '$lib/teleparty-domain';
	import type { OwnerSettingsDraft, ParticipantViewModel } from '$lib/view-models';

	type OwnerPanelProps = {
		onSave: (draft: OwnerSettingsDraft) => Promise<void> | void;
		onToggleParticipantStageControl: (participant: {
			capabilities: RoomCapability[];
			sessionId: string;
		}) => Promise<void> | void;
		ownerSessionId: string;
		participantAccessError: string | null;
		participants: ParticipantViewModel[];
		settingsError: string | null;
		soundboardPolicy: SoundboardPolicy;
		stageInteractionPolicy: StageInteractionPolicy;
		updatingParticipantSessionId: string | null;
	};

	let {
		onSave,
		onToggleParticipantStageControl,
		ownerSessionId,
		participantAccessError,
		participants,
		settingsError,
		soundboardPolicy,
		stageInteractionPolicy,
		updatingParticipantSessionId
	}: OwnerPanelProps = $props();

	let ownerDraftPolicy = $state<SoundboardPolicy>({
		kind: 'auto',
		defaultMaxParticipants: 8
	});
	let ownerDraftStagePolicy = $state<StageInteractionPolicy>({
		kind: 'owner_only'
	});
	let lastSyncedPolicySignature = $state('');
	let lastSyncedStagePolicySignature = $state('');

	let soundboardPolicySignature = $derived(JSON.stringify(soundboardPolicy));
	let stagePolicySignature = $derived(JSON.stringify(stageInteractionPolicy));
	let soundboardDirty = $derived(JSON.stringify(ownerDraftPolicy) !== soundboardPolicySignature);
	let stageDirty = $derived(JSON.stringify(ownerDraftStagePolicy) !== stagePolicySignature);
	let settingsDirty = $derived(soundboardDirty || stageDirty);

	let manageableParticipants = $derived.by(() =>
		[...participants]
			.filter((participant) => participant.sessionId !== ownerSessionId)
			.sort((left, right) => {
				if (left.online !== right.online) {
					return left.online ? -1 : 1;
				}
				return left.displayName.localeCompare(right.displayName);
			})
	);

	$effect(() => {
		if (soundboardPolicySignature !== lastSyncedPolicySignature) {
			lastSyncedPolicySignature = soundboardPolicySignature;
			ownerDraftPolicy =
				soundboardPolicy.kind === 'manual'
					? { ...soundboardPolicy }
					: { ...soundboardPolicy };
		}
	});

	$effect(() => {
		if (stagePolicySignature !== lastSyncedStagePolicySignature) {
			lastSyncedStagePolicySignature = stagePolicySignature;
			ownerDraftStagePolicy = { ...stageInteractionPolicy };
		}
	});

	function setManualMode(enabled: boolean) {
		ownerDraftPolicy = enabled
			? ownerDraftPolicy.kind === 'manual'
				? ownerDraftPolicy
				: {
						kind: 'manual',
						enabled: true,
						maxParticipants: ownerDraftPolicy.defaultMaxParticipants
					}
			: ownerDraftPolicy.kind === 'auto'
				? ownerDraftPolicy
				: {
						kind: 'auto',
						defaultMaxParticipants: ownerDraftPolicy.maxParticipants
					};
	}

	function setStageAccess(enabled: boolean) {
		ownerDraftStagePolicy = {
			kind: enabled ? 'everyone' : 'owner_only'
		};
	}

	function handleSave() {
		onSave({
			soundboardDirty,
			soundboardPolicy: ownerDraftPolicy,
			stageDirty,
			stageInteractionPolicy: ownerDraftStagePolicy
		});
	}
</script>

<section class="panel owner-panel">
	<div class="panel-header">
		<p class="eyebrow">Owner controls</p>
		<h2 class="panel-title">Room policy</h2>
		<p class="quiet">
			Use room-wide defaults first, then grant exceptions only where you actually need them.
		</p>
	</div>

	<div class="policy-card">
		<div class="policy-header">
			<div>
				<p class="control-title">Manual soundboard mode</p>
				<p class="quiet">Auto mode falls back to the default crowd ceiling.</p>
			</div>
			<label class="switch">
				<input
					checked={ownerDraftPolicy.kind === 'manual'}
					onchange={(event) => setManualMode((event.currentTarget as HTMLInputElement).checked)}
					type="checkbox"
				/>
				<span class="switch-track"></span>
			</label>
		</div>

		{#if ownerDraftPolicy.kind === 'manual'}
			<div class="manual-controls">
				<label class="checkline">
					<input
						checked={ownerDraftPolicy.enabled}
						onchange={(event) => {
							if (ownerDraftPolicy.kind !== 'manual') {
								return;
							}

							ownerDraftPolicy = {
								...ownerDraftPolicy,
								enabled: (event.currentTarget as HTMLInputElement).checked
							};
						}}
						type="checkbox"
					/>
					<span>Enable soundboard</span>
				</label>
			</div>
		{/if}

		<div class="policy-card subtle-card">
			<div class="policy-header">
				<div>
					<p class="control-title">Guest video controls</p>
					<p class="quiet">
						Allow non-owners to click play, pause, and scrub inside the shared stage.
					</p>
				</div>
				<label class="switch">
					<input
						checked={ownerDraftStagePolicy.kind === 'everyone'}
						onchange={(event) => setStageAccess((event.currentTarget as HTMLInputElement).checked)}
						type="checkbox"
					/>
					<span class="switch-track"></span>
				</label>
			</div>
		</div>

		<div class="participant-policy">
			<div>
				<p class="control-title">Participant access</p>
				<p class="quiet">
					Grant direct stage control to specific guests when room-wide guest controls are off.
				</p>
			</div>

			{#if manageableParticipants.length === 0}
				<p class="quiet">Participants appear here after they join the room.</p>
			{:else}
				<div class="participant-stack">
					{#each manageableParticipants as participant (participant.sessionId)}
						<div class="participant-row">
							<div class="participant-copy">
								<div class="participant-topline">
									<span
										class="participant-dot"
										style={`background-color:${participant.color};`}
									></span>
									<p>{participant.displayName}</p>
									<span class:offline={!participant.online} class="participant-status">
										{participant.online ? 'online' : 'offline'}
									</span>
								</div>
								<p class="quiet participant-note">
									{ownerDraftStagePolicy.kind === 'everyone'
										? 'Room-wide guest controls are on. Individual grants are stored but not needed right now.'
										: participant.capabilities.includes('stage_control')
											? 'Has direct stage control when guests are otherwise locked.'
											: 'No direct stage control.'}
								</p>
							</div>
							<label class="switch">
								<input
									checked={participant.capabilities.includes('stage_control')}
									disabled={ownerDraftStagePolicy.kind === 'everyone' ||
										updatingParticipantSessionId === participant.sessionId}
									onchange={() => onToggleParticipantStageControl(participant)}
									type="checkbox"
								/>
								<span class="switch-track"></span>
							</label>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<label class="slider-line">
			<span>Max participants</span>
			<strong>
				{ownerDraftPolicy.kind === 'manual'
					? ownerDraftPolicy.maxParticipants
					: ownerDraftPolicy.defaultMaxParticipants}
			</strong>
			<input
				max="40"
				min="2"
				oninput={(event) => {
					const value = Number((event.currentTarget as HTMLInputElement).value);
					ownerDraftPolicy =
						ownerDraftPolicy.kind === 'manual'
							? { ...ownerDraftPolicy, maxParticipants: value }
							: { ...ownerDraftPolicy, defaultMaxParticipants: value };
				}}
				type="range"
				value={ownerDraftPolicy.kind === 'manual'
					? ownerDraftPolicy.maxParticipants
					: ownerDraftPolicy.defaultMaxParticipants}
			/>
		</label>

		<div class="owner-actions">
			<button
				class="button-primary compact-button"
				disabled={!settingsDirty}
				onclick={handleSave}
				type="button"
			>
				Save settings
			</button>
		</div>
	</div>

	{#if settingsError}
		<p class="error-banner panel-error">{settingsError}</p>
	{/if}

	{#if participantAccessError}
		<p class="error-banner panel-error">{participantAccessError}</p>
	{/if}
</section>

<style>
	.owner-panel {
		padding: 1.25rem;
	}

	.policy-card {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
		border: 1px solid var(--line-soft);
		border-radius: 1.7rem;
		background: var(--surface-tint);
		padding: 1rem;
	}

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

	.subtle-card {
		margin-top: 0;
	}

	.participant-policy {
		display: grid;
		gap: 0.85rem;
		padding: 1rem 0 0;
		border-top: 1px solid var(--line-soft);
	}

	.participant-stack {
		display: grid;
		gap: 0.75rem;
	}

	.participant-row {
		display: flex;
		gap: 0.8rem;
		align-items: start;
		justify-content: space-between;
		border: 1px solid var(--line-soft);
		border-radius: 1.15rem;
		background: var(--surface-strong);
		padding: 0.9rem;
	}

	.participant-copy {
		min-width: 0;
	}

	.participant-topline {
		display: flex;
		gap: 0.45rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.participant-topline p {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.participant-dot {
		display: inline-flex;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
	}

	.participant-status {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		background: color-mix(in oklch, var(--moss) 18%, white 82%);
		padding: 0.18rem 0.5rem;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: color-mix(in oklch, var(--moss) 64%, black 36%);
	}

	.participant-status.offline {
		background: color-mix(in oklch, black 10%, white 90%);
		color: var(--ink-soft);
	}

	.participant-note {
		margin-top: 0.35rem;
		font-size: 0.82rem;
	}

	.manual-controls {
		display: grid;
		gap: 1rem;
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

	.owner-actions {
		display: flex;
		justify-content: flex-start;
	}

	.compact-button {
		padding: 0.82rem 1rem;
	}

	.panel-error {
		margin-top: 1rem;
	}
</style>
