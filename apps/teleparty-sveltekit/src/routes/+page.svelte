<script lang="ts">
	import { goto } from '$app/navigation';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import CreateRoomPanel from '$lib/components/lobby/CreateRoomPanel.svelte';
	import LobbyHero from '$lib/components/lobby/LobbyHero.svelte';
	import PublicRoomsPanel from '$lib/components/lobby/PublicRoomsPanel.svelte';
	import SessionCard from '$lib/components/shared/SessionCard.svelte';
	import { api } from '$lib/convex-api';
	import {
		DEFAULT_AUTO_SOUNDBOARD_CAPACITY,
		DEFAULT_STAGE_INTERACTION_POLICY,
		createRoomInputSchema,
		type SoundboardPolicy,
		type Visibility
	} from '$lib/teleparty-domain';
	import { sessionProfile, sessionReady, updateSessionProfile } from '$lib/session';
	import type { PublicRoomSummary } from '$lib/view-models';

	const client = useConvexClient();

	const cinematicPresets = [
		{
			label: 'Director commentary',
			url: 'https://www.youtube.com/watch?v=akVP_TF7jDI'
		},
		{
			label: 'Title sequence',
			url: 'https://www.youtube.com/watch?v=ScMzIvxBSi4'
		},
		{
			label: 'Late-night cut',
			url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
		}
	];

	const publicRoomsQuery = useQuery(api.rooms.listPublicRooms, () => ({
		limit: 12
	}));
	const roomPolicyQuery = useQuery(api.rooms.defaultRoomPolicy, () => ({}));

	let watchUrl = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	let autoCapacity = $derived(
		roomPolicyQuery.data?.soundboardPolicy.defaultMaxParticipants ??
			DEFAULT_AUTO_SOUNDBOARD_CAPACITY
	);
	let publicRooms = $derived((publicRoomsQuery.data ?? []) as PublicRoomSummary[]);

	function updateDisplayName(value: string) {
		if (!$sessionReady) {
			return;
		}

		updateSessionProfile((current) => ({
			...current,
			displayName: value
		}));
	}

	async function createRoom({
		soundboardPolicy,
		visibility,
		watchUrl: nextWatchUrl
	}: {
		soundboardPolicy: SoundboardPolicy;
		visibility: Visibility;
		watchUrl: string;
	}) {
		error = null;

		if (!$sessionReady) {
			error = 'Session is still initializing. Retry in a moment.';
			return;
		}

		isSubmitting = true;

		try {
			const parsed = createRoomInputSchema.parse({
				watchUrl: nextWatchUrl,
				visibility,
				soundboardPolicy,
				stageInteractionPolicy: DEFAULT_STAGE_INTERACTION_POLICY
			});

			const room = await client.mutation(api.rooms.createRoom, {
				watchUrl: parsed.watchUrl,
				ownerSessionId: $sessionProfile.sessionId,
				ownerSessionSecret: $sessionProfile.sessionSecret,
				ownerDisplayName: $sessionProfile.displayName,
				ownerColor: $sessionProfile.color,
				visibility: parsed.visibility,
				soundboardPolicy: parsed.soundboardPolicy,
				stageInteractionPolicy: parsed.stageInteractionPolicy
			});

			await goto(`/rooms/${room.roomCode}`);
		} catch (unknownError) {
			error =
				unknownError instanceof Error
					? unknownError.message
					: 'Failed to create room. Please retry.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Teleparty Studio / SvelteKit + Convex</title>
	<meta
		name="description"
		content="A SvelteKit frontend for the Teleparty Clone Lab, wired to the live Convex backend."
	/>
</svelte:head>

<div class="shell">
	<LobbyHero
		onPresetSelect={(nextUrl) => {
			watchUrl = nextUrl;
		}}
		presets={cinematicPresets}
	/>

	<section class="dashboard">
		<CreateRoomPanel
			{autoCapacity}
			{error}
			{isSubmitting}
			bind:watchUrl
			onCreate={createRoom}
		/>

		<aside class="stack">
			<SessionCard
				eyebrow="Presence"
				profile={$sessionProfile}
				subtitle="Reusable identity state lives at layout level now, not inside each route."
				title="Your Session"
				updateDisplayName={updateDisplayName}
			/>

			<PublicRoomsPanel
				error={publicRoomsQuery.error?.message ?? null}
				isLoading={publicRoomsQuery.isLoading}
				onOpenRoom={(roomCode) => goto(`/rooms/${roomCode}`)}
				rooms={publicRooms}
			/>
		</aside>
	</section>
</div>

<style>
	.dashboard {
		display: grid;
		gap: 1.4rem;
	}

	.stack {
		display: grid;
		gap: 1.4rem;
	}

	@media (min-width: 860px) {
		.dashboard {
			grid-template-columns: minmax(0, 1.18fr) minmax(19rem, 0.82fr);
			align-items: start;
		}
	}
</style>
