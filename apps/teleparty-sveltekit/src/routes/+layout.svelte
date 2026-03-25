<script lang="ts">
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import { setupConvex } from 'convex-svelte';
	import { hydrateSessionProfile } from '$lib/session';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	const PUBLIC_CONVEX_URL = env.PUBLIC_CONVEX_URL;

	if (!PUBLIC_CONVEX_URL) {
		throw new Error(
			'PUBLIC_CONVEX_URL is required. Use `just sveltekit-dev` or export the Convex deployment URL first.'
		);
	}

	setupConvex(PUBLIC_CONVEX_URL);

	let { children } = $props();

	$effect(() => {
		if (!browser) {
			return;
		}

		hydrateSessionProfile();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

{@render children()}
