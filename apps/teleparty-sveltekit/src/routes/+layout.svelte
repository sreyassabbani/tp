<script lang="ts">
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { setupConvex } from 'convex-svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	if (!PUBLIC_CONVEX_URL) {
		throw new Error(
			'PUBLIC_CONVEX_URL is required. Use `just sveltekit-dev` or export the Convex deployment URL first.'
		);
	}

	setupConvex(PUBLIC_CONVEX_URL);

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

{@render children()}
