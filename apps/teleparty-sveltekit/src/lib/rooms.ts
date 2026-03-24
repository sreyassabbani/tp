import { browser } from '$app/environment';
import { customAlphabet } from 'nanoid';
import { get, writable } from 'svelte/store';
import { z } from 'zod';
import {
	createRoomInputSchema,
	normalizeAccessCode,
	roomCodeSchema,
	soundIdSchema,
	soundboardPolicySchema,
	visibilitySchema,
	watchUrlSchema,
	type SoundId,
	type SoundboardPolicy,
	type Visibility
} from '$lib/teleparty-domain';
import type { SessionProfile } from '$lib/session';

const storageKey = 'tp-svelte-rooms-v1';
const createRoomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

const stagePointSchema = z.object({
	x: z.number().min(0).max(1),
	y: z.number().min(0).max(1)
});

export type StagePoint = z.infer<typeof stagePointSchema>;

const drawingStrokeSchema = z.object({
	strokeId: z.string().min(1),
	color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
	points: z.array(stagePointSchema).min(2),
	createdAtMs: z.number().int()
});

const soundEventSchema = z.object({
	eventId: z.string().min(1),
	actorDisplayName: z.string().min(2).max(24),
	soundId: soundIdSchema,
	createdAtMs: z.number().int()
});

const roomRecordSchema = z.object({
	roomCode: roomCodeSchema,
	watchUrl: watchUrlSchema,
	watchHost: z.string().min(1),
	ownerSessionId: z.string().min(8).max(64),
	ownerDisplayName: z.string().min(2).max(24),
	visibility: visibilitySchema,
	soundboardPolicy: soundboardPolicySchema,
	createdAtMs: z.number().int(),
	drawingStrokes: z.array(drawingStrokeSchema),
	soundEvents: z.array(soundEventSchema)
});

export type DrawingStroke = z.infer<typeof drawingStrokeSchema>;
export type SoundEvent = z.infer<typeof soundEventSchema>;
export type RoomRecord = z.infer<typeof roomRecordSchema>;

export const roomsStore = writable<RoomRecord[]>([]);
export const roomsReady = writable(false);

function parseRoomList(raw: string | null): RoomRecord[] {
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.flatMap((room) => {
			const result = roomRecordSchema.safeParse(room);
			return result.success ? [result.data] : [];
		});
	} catch {
		return [];
	}
}

function watchHostFromUrl(watchUrl: string): string {
	const parsed = new URL(watchUrl);
	return parsed.hostname.replace(/^www\./, '');
}

function persistRooms(nextRooms: RoomRecord[]): void {
	const parsed = z.array(roomRecordSchema).parse(nextRooms);
	roomsStore.set(parsed);

	if (browser) {
		window.localStorage.setItem(storageKey, JSON.stringify(parsed));
	}
}

function updateRoom(
	roomCode: string,
	mutate: (room: RoomRecord) => RoomRecord
): RoomRecord {
	const currentRooms = get(roomsStore);
	const index = currentRooms.findIndex((room) => room.roomCode === roomCode);

	if (index < 0) {
		throw new Error('Room not found.');
	}

	const updatedRoom = roomRecordSchema.parse(mutate(currentRooms[index]));
	const nextRooms = [...currentRooms];
	nextRooms[index] = updatedRoom;
	persistRooms(nextRooms);
	return updatedRoom;
}

function nextUniqueRoomCode(existingCodes: Set<string>): string {
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const candidate = createRoomCode();
		if (!existingCodes.has(candidate)) {
			return candidate;
		}
	}

	throw new Error('Failed to generate a unique room code.');
}

export function hydrateRooms(): void {
	if (!browser) {
		roomsStore.set([]);
		roomsReady.set(true);
		return;
	}

	const parsed = parseRoomList(window.localStorage.getItem(storageKey));
	roomsStore.set(parsed);
	roomsReady.set(true);
}

export function listPublicRooms(rooms: RoomRecord[]): RoomRecord[] {
	return [...rooms]
		.filter((room) => room.visibility.kind === 'public')
		.sort((left, right) => right.createdAtMs - left.createdAtMs);
}

export function createRoomRecord(input: {
	watchUrl: string;
	visibility: Visibility;
	soundboardPolicy: SoundboardPolicy;
	sessionProfile: SessionProfile;
}): RoomRecord {
	const parsed = createRoomInputSchema.parse({
		watchUrl: input.watchUrl,
		visibility: input.visibility,
		soundboardPolicy: input.soundboardPolicy
	});

	const currentRooms = get(roomsStore);
	const roomCode = nextUniqueRoomCode(new Set(currentRooms.map((room) => room.roomCode)));
	const createdAtMs = Date.now();
	const room = roomRecordSchema.parse({
		roomCode,
		watchUrl: parsed.watchUrl,
		watchHost: watchHostFromUrl(parsed.watchUrl),
		ownerSessionId: input.sessionProfile.sessionId,
		ownerDisplayName: input.sessionProfile.displayName,
		visibility: parsed.visibility,
		soundboardPolicy: parsed.soundboardPolicy,
		createdAtMs,
		drawingStrokes: [],
		soundEvents: []
	});

	persistRooms([room, ...currentRooms]);
	return room;
}

export function validateRoomAccess(room: RoomRecord, accessCode: string): boolean {
	if (room.visibility.kind === 'public') {
		return true;
	}

	return normalizeAccessCode(accessCode) === room.visibility.accessCode;
}

export function saveRoomSoundboardPolicy(
	roomCode: string,
	ownerSessionId: string,
	soundboardPolicy: SoundboardPolicy
): RoomRecord {
	return updateRoom(roomCode, (room) => {
		if (room.ownerSessionId !== ownerSessionId) {
			throw new Error('Only the owner can update room policy.');
		}

		return {
			...room,
			soundboardPolicy: soundboardPolicySchema.parse(soundboardPolicy)
		};
	});
}

export function appendSoundEvent(
	roomCode: string,
	actorDisplayName: string,
	soundId: SoundId
): RoomRecord {
	return updateRoom(roomCode, (room) => ({
		...room,
		soundEvents: [
			...room.soundEvents.slice(-15),
			soundEventSchema.parse({
				eventId: `${roomCode}-${soundId}-${Date.now()}`,
				actorDisplayName,
				soundId,
				createdAtMs: Date.now()
			})
		]
	}));
}

export function addDrawingStroke(
	roomCode: string,
	stroke: { color: string; points: StagePoint[] }
): RoomRecord {
	return updateRoom(roomCode, (room) => ({
		...room,
		drawingStrokes: [
			...room.drawingStrokes.slice(-47),
			drawingStrokeSchema.parse({
				strokeId: `${roomCode}-${Date.now()}`,
				color: stroke.color,
				points: stroke.points,
				createdAtMs: Date.now()
			})
		]
	}));
}

export function clearDrawingStrokes(
	roomCode: string,
	ownerSessionId: string
): RoomRecord {
	return updateRoom(roomCode, (room) => {
		if (room.ownerSessionId !== ownerSessionId) {
			throw new Error('Only the owner can clear drawings.');
		}

		return {
			...room,
			drawingStrokes: []
		};
	});
}
