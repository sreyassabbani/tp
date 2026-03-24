import { browser } from '$app/environment';
import { customAlphabet } from 'nanoid';
import { writable, get } from 'svelte/store';
import { z } from 'zod';

const sessionSchema = z.object({
	sessionId: z.string().min(8).max(64),
	displayName: z.string().min(2).max(24),
	color: z.string().regex(/^#[a-fA-F0-9]{6}$/)
});

export type SessionProfile = z.infer<typeof sessionSchema>;

const storageKey = 'tp-svelte-session-v1';
const makeId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 20);

const adjectives = ['Keen', 'Swift', 'Fuzzy', 'Mellow', 'Sneaky', 'Lucky', 'Cosmic', 'Brisk'];
const nouns = ['Otter', 'Comet', 'Fox', 'Sparrow', 'Panda', 'Lynx', 'Tiger'];
const palette = ['#cc5632', '#3c7ddb', '#23816e', '#9d3d39', '#d58c28', '#7c5bf1'];

const initialSessionProfile: SessionProfile = {
	sessionId: 'pending-session-id',
	displayName: 'Guest Otter',
	color: '#7c5bf1'
};

function randomItem<T>(values: readonly T[]): T {
	return values[Math.floor(Math.random() * values.length)];
}

function createDefaultProfile(): SessionProfile {
	return {
		sessionId: makeId(),
		displayName: `${randomItem(adjectives)} ${randomItem(nouns)}`,
		color: randomItem(palette)
	};
}

export const sessionProfile = writable<SessionProfile>(initialSessionProfile);
export const sessionReady = writable(false);

export function loadSessionProfile(): SessionProfile {
	if (!browser) {
		return initialSessionProfile;
	}

	const raw = window.localStorage.getItem(storageKey);
	if (!raw) {
		const profile = createDefaultProfile();
		window.localStorage.setItem(storageKey, JSON.stringify(profile));
		return profile;
	}

	try {
		const parsed = sessionSchema.safeParse(JSON.parse(raw));
		if (parsed.success) {
			return parsed.data;
		}
	} catch {
		// fall through to reset
	}

	const fallback = createDefaultProfile();
	window.localStorage.setItem(storageKey, JSON.stringify(fallback));
	return fallback;
}

export function hydrateSessionProfile(): void {
	sessionProfile.set(loadSessionProfile());
	sessionReady.set(true);
}

export function saveSessionProfile(nextValue: SessionProfile): SessionProfile {
	const parsed = sessionSchema.parse(nextValue);

	if (browser) {
		window.localStorage.setItem(storageKey, JSON.stringify(parsed));
	}

	return parsed;
}

export function updateSessionProfile(
	nextValue: SessionProfile | ((current: SessionProfile) => SessionProfile)
): SessionProfile {
	const current = get(sessionProfile);
	const nextProfile =
		typeof nextValue === 'function' ? nextValue(current) : nextValue;
	const parsed = saveSessionProfile(nextProfile);
	sessionProfile.set(parsed);
	return parsed;
}
