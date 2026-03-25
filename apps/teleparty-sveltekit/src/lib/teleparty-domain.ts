import { z } from 'zod';

export const DEFAULT_AUTO_SOUNDBOARD_CAPACITY = 8;
export const MIN_SOUNDBOARD_CAPACITY = 2;
export const MAX_SOUNDBOARD_CAPACITY = 64;

export const soundIdSchema = z.enum([
	'airhorn',
	'rimshot',
	'cheer',
	'boo',
	'ta-da',
	'whoosh'
]);

export const roomCapabilitySchema = z.enum(['stage_control', 'soundboard', 'draw']);

export const roomCapabilitiesSchema = z
	.array(roomCapabilitySchema)
	.max(8)
	.transform((values) => Array.from(new Set(values)));

export const roomCodeSchema = z
	.string()
	.trim()
	.toUpperCase()
	.regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

export const accessCodeSchema = z
	.string()
	.trim()
	.min(4)
	.max(16)
	.regex(/^[a-zA-Z0-9_-]+$/)
	.transform((value) => value.toLowerCase());

export const visibilitySchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('public') }),
	z.object({ kind: z.literal('private'), accessCode: accessCodeSchema })
]);

export const soundboardPolicySchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('auto'),
		defaultMaxParticipants: z
			.number()
			.int()
			.min(MIN_SOUNDBOARD_CAPACITY)
			.max(MAX_SOUNDBOARD_CAPACITY)
	}),
	z.object({
		kind: z.literal('manual'),
		enabled: z.boolean(),
		maxParticipants: z
			.number()
			.int()
			.min(MIN_SOUNDBOARD_CAPACITY)
			.max(MAX_SOUNDBOARD_CAPACITY)
	})
]);

export const stageInteractionPolicySchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('owner_only')
	}),
	z.object({
		kind: z.literal('everyone')
	})
]);

export type StageInteractionPolicy = z.infer<typeof stageInteractionPolicySchema>;
export type RoomCapability = z.infer<typeof roomCapabilitySchema>;

export const DEFAULT_STAGE_INTERACTION_POLICY: StageInteractionPolicy = {
	kind: 'everyone'
};

export const watchUrlSchema = z
	.string()
	.trim()
	.url()
	.transform((value) => {
		const parsed = new URL(value);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw new Error('Only http/https links are supported.');
		}
		return parsed.toString();
	});

export const createRoomInputSchema = z.object({
	watchUrl: watchUrlSchema,
	visibility: visibilitySchema,
	soundboardPolicy: soundboardPolicySchema,
	stageInteractionPolicy: stageInteractionPolicySchema
});

export const roomJoinInputSchema = z.object({
	roomCode: roomCodeSchema,
	accessCode: z.string().optional()
});

export type Visibility = z.infer<typeof visibilitySchema>;
export type SoundboardPolicy = z.infer<typeof soundboardPolicySchema>;
export type SoundId = z.infer<typeof soundIdSchema>;

export function normalizeAccessCode(value?: string): string {
	if (!value) {
		return '';
	}
	return value.trim().toLowerCase();
}

export function normalizeRoomCode(value: string): string {
	return roomCodeSchema.parse(value);
}

export function canUseSoundboard(
	policy: SoundboardPolicy,
	participantCount: number
): boolean {
	if (policy.kind === 'auto') {
		return participantCount <= policy.defaultMaxParticipants;
	}
	return policy.enabled && participantCount <= policy.maxParticipants;
}

export function canInteractWithStage(
	policy: StageInteractionPolicy,
	isOwner: boolean,
	capabilities: RoomCapability[] = []
): boolean {
	return (
		isOwner ||
		policy.kind === 'everyone' ||
		capabilities.includes('stage_control')
	);
}

const YOUTUBE_HOSTS = new Set([
	'youtube.com',
	'www.youtube.com',
	'm.youtube.com',
	'youtu.be',
	'www.youtu.be',
	'youtube-nocookie.com',
	'www.youtube-nocookie.com'
]);

const youtubeIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{11}$/);

function parseYouTubeVideoId(url: URL): string | null {
	const host = url.hostname.toLowerCase();
	if (!YOUTUBE_HOSTS.has(host)) {
		return null;
	}

	if (host.includes('youtu.be')) {
		const id = url.pathname.split('/').filter(Boolean)[0];
		if (!id) {
			return null;
		}
		return youtubeIdSchema.safeParse(id).success ? id : null;
	}

	const pathSegments = url.pathname.split('/').filter(Boolean);
	const firstSegment = pathSegments[0];
	const secondSegment = pathSegments[1];

	if (firstSegment === 'watch') {
		const id = url.searchParams.get('v');
		if (!id) {
			return null;
		}
		return youtubeIdSchema.safeParse(id).success ? id : null;
	}

	if ((firstSegment === 'embed' || firstSegment === 'shorts') && secondSegment) {
		return youtubeIdSchema.safeParse(secondSegment).success ? secondSegment : null;
	}

	return null;
}

function parseYouTubeStartSeconds(value: string | null): number | null {
	if (!value) {
		return null;
	}

	if (/^\d+$/.test(value)) {
		return Number(value);
	}

	const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
	if (!match) {
		return null;
	}

	const hours = Number(match[1] ?? '0');
	const minutes = Number(match[2] ?? '0');
	const seconds = Number(match[3] ?? '0');

	const totalSeconds = hours * 3600 + minutes * 60 + seconds;
	return totalSeconds > 0 ? totalSeconds : null;
}

export function getWatchFrameUrl(watchUrl: string): string {
	const parsed = new URL(watchUrl);
	const videoId = parseYouTubeVideoId(parsed);

	if (!videoId) {
		return parsed.toString();
	}

	const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
	const startSeconds =
		parseYouTubeStartSeconds(parsed.searchParams.get('start')) ??
		parseYouTubeStartSeconds(parsed.searchParams.get('t'));

	if (startSeconds) {
		embedUrl.searchParams.set('start', String(startSeconds));
	}

	return embedUrl.toString();
}
