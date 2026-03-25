import type { ConvexClient } from 'convex/browser';
import { api } from '$lib/convex-api';

const DEFAULT_PRESENCE_INTERVAL_MS = 10_000;

type PresenceSessionOptions = {
	baseUrl: string;
	client: ConvexClient;
	roomId: string;
	userId: string;
	intervalMs?: number;
};

export function startPresenceSession({
	baseUrl,
	client,
	roomId,
	userId,
	intervalMs = DEFAULT_PRESENCE_INTERVAL_MS
}: PresenceSessionOptions): () => void {
	let stopped = false;
	let sessionId = crypto.randomUUID();
	let sessionToken: string | null = null;
	let heartbeatTimer: number | null = null;

	async function disconnect() {
		if (!sessionToken) {
			return;
		}

		const activeToken = sessionToken;
		sessionToken = null;

		try {
			await client.mutation(api.presence.disconnect, {
				sessionToken: activeToken
			});
		} catch {
			// Ignore transient disconnect failures; the session will expire server-side.
		}
	}

	async function sendHeartbeat() {
		if (stopped) {
			return;
		}

		const result = await client.mutation(api.presence.heartbeat, {
			roomId,
			userId,
			sessionId,
			interval: intervalMs
		});

		sessionToken = result.sessionToken;
	}

	function clearHeartbeatTimer() {
		if (heartbeatTimer !== null) {
			window.clearInterval(heartbeatTimer);
			heartbeatTimer = null;
		}
	}

	function startHeartbeatTimer() {
		clearHeartbeatTimer();
		heartbeatTimer = window.setInterval(() => {
			void sendHeartbeat();
		}, intervalMs);
	}

	function handleUnload() {
		if (!sessionToken) {
			return;
		}

		const blob = new Blob(
			[
				JSON.stringify({
					path: 'presence:disconnect',
					args: { sessionToken }
				})
			],
			{
				type: 'application/json'
			}
		);

		navigator.sendBeacon(`${baseUrl}/api/mutation`, blob);
	}

	async function handleVisibilityChange() {
		if (document.hidden) {
			clearHeartbeatTimer();
			await disconnect();
			return;
		}

		sessionId = crypto.randomUUID();
		await sendHeartbeat();
		startHeartbeatTimer();
	}

	const wrappedVisibilityHandler = () => {
		void handleVisibilityChange();
	};

	window.addEventListener('beforeunload', handleUnload);
	document.addEventListener('visibilitychange', wrappedVisibilityHandler);

	void sendHeartbeat();
	startHeartbeatTimer();

	return () => {
		stopped = true;
		clearHeartbeatTimer();
		document.removeEventListener('visibilitychange', wrappedVisibilityHandler);
		window.removeEventListener('beforeunload', handleUnload);
		void disconnect();
	};
}
