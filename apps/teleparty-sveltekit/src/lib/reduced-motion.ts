import { browser } from '$app/environment';
import { readable } from 'svelte/store';

const QUERY = '(prefers-reduced-motion: reduce)';

export const reducedMotion = readable(false, (set) => {
	if (!browser) {
		return;
	}

	const mediaQuery = window.matchMedia(QUERY);
	const update = () => set(mediaQuery.matches);

	update();
	mediaQuery.addEventListener('change', update);

	return () => {
		mediaQuery.removeEventListener('change', update);
	};
});
