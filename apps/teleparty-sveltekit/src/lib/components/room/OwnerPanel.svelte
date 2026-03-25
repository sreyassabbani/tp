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
			Set room-wide defaults first, then hand out exceptions only when the session really calls for it.
		</p>
	</div>

	<div class="owner-grid">
		<div class="detail-stack">
			<div class="settings-block tint">
				<div class="toggle-row">
					<div class="toggle-copy">
						<p class="control-title">Manual soundboard mode</p>
						<p class="quiet">Auto mode follows the default crowd ceiling until you take over.</p>
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
							<span>Enable soundboard cues</span>
						</label>
					</div>
				{/if}

				<label class="slider-line">
					<span>Max participants</span>
					<strong>
						{ownerDraftPolicy.kind === 'manual'
							? ownerDraftPolicy.maxParticipants
							: ownerDraftPolicy.defaultMaxParticipants}
					</strong>
					<input
						class="range-input"
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
			</div>

			<div class="settings-block">
				<div class="toggle-row">
					<div class="toggle-copy">
						<p class="control-title">Guest video controls</p>
						<p class="quiet">Allow non-owners to click play, pause, and scrub inside the shared stage.</p>
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

				<div class="summary-bar">
					<p class="eyebrow">Stage access</p>
					<p class="quiet">
						{ownerDraftStagePolicy.kind === 'everyone'
							? 'Guests can control the shared player directly.'
							: 'Guests stay in cursor mode unless you grant them a direct override.'}
					</p>
				</div>
			</div>
		</div>

		<div class="settings-block participant-policy">
			<div class="toggle-copy">
				<p class="control-title">Participant access</p>
				<p class="quiet">
					Grant direct stage control to specific guests when room-wide guest controls are off.
				</p>
			</div>

			{#if manageableParticipants.length === 0}
				<div class="empty-state">
					<p class="empty-title">No guests to tune yet.</p>
					<p class="quiet">Participants appear here after they join the room.</p>
				</div>
			{:else}
				<div class="participant-stack">
					{#each manageableParticipants as participant (participant.sessionId)}
						<div class="participant-row">
							<div class="participant-copy">
								<div class="participant-topline">
									<span class="participant-dot" style={`background-color:${participant.color};`}></span>
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
	</div>

	{#if settingsError}
		<p aria-live="polite" class="error-banner panel-error">{settingsError}</p>
	{/if}

	{#if participantAccessError}
		<p aria-live="polite" class="error-banner panel-error">{participantAccessError}</p>
	{/if}

	<div class="owner-actions">
		<p class="quiet">Policy changes apply instantly to the live room.</p>
		<button class="button-primary" disabled={!settingsDirty} onclick={handleSave} type="button">
			Save settings
		</button>
	</div>
</section>
