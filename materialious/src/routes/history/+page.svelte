<script lang="ts">
	import { getHistory, getVideo } from '$lib/Api';
	import type { VideoPlay } from '$lib/Api/model';
	import VideoList from '$lib/VideoList.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { activePage } from '../../store';

	activePage.set('history');

	let history: VideoPlay[] = [];
	let loaded = false;

	let currentPage = 1;

	async function loadPageHistory() {
		const videoIds = await getHistory(currentPage);
		let promises = [];
		for (const videoId of videoIds) {
			promises.push(getVideo(videoId));
		}

		const loadedHistory = await Promise.all(promises);
		history = [...history, ...loadedHistory];
	}

	async function handleScroll() {
		const { scrollTop, clientHeight, scrollHeight } = document.documentElement;
		if (scrollTop + clientHeight >= scrollHeight - 5) {
			currentPage += 1;
			await loadPageHistory();
		}
	}

	onMount(async () => {
		await loadPageHistory();
		loaded = true;

		window.addEventListener('scroll', handleScroll);
	});

	onDestroy(() => {
		window.removeEventListener('scroll', handleScroll);
	});
</script>

<VideoList videos={history} />
