import type {
	RoomCapability,
	SoundboardPolicy,
	StageInteractionPolicy,
	Visibility
} from '$lib/teleparty-domain';

export type PublicRoomSummary = Readonly<{
	createdAt: number;
	createdByDisplayName: string;
	participantCount: number;
	roomCode: string;
	soundboardPolicy: SoundboardPolicy;
	watchHost: string;
	watchUrl: string;
}>;

export type ParticipantViewModel = Readonly<{
	canControlStage: boolean;
	capabilities: RoomCapability[];
	color: string;
	displayName: string;
	online: boolean;
	sessionId: string;
}>;

export type RoomViewModel = Readonly<{
	createdAt: number;
	createdByDisplayName: string;
	createdBySessionId: string;
	participantCount: number;
	participants: ParticipantViewModel[];
	roomCode: string;
	soundboardPolicy: SoundboardPolicy;
	stageInteractionPolicy: StageInteractionPolicy;
	visibility: Visibility;
	watchHost: string;
	watchUrl: string;
}>;

export type RoomLookupResult =
	| Readonly<{ kind: 'not_found' }>
	| Readonly<{ kind: 'forbidden' }>
	| Readonly<{ kind: 'ok'; room: RoomViewModel }>;

export type CursorViewModel = Readonly<{
	color: string;
	displayName: string;
	sessionId: string;
	x: number;
	y: number;
}>;

export type SoundEventViewModel = Readonly<{
	actorDisplayName: string;
	createdAt: number;
	eventId: string;
	soundId: string;
}>;

export type OwnerSettingsDraft = Readonly<{
	soundboardDirty: boolean;
	soundboardPolicy: SoundboardPolicy;
	stageDirty: boolean;
	stageInteractionPolicy: StageInteractionPolicy;
}>;
