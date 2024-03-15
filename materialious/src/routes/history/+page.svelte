<script lang="ts">
	import { getHistory, getVideo } from '$lib/Api';
	import type { VideoPlay } from '$lib/Api/model';
	import VideoList from '$lib/VideoList.svelte';
	import { onMount } from 'svelte';
	import { activePage } from '../../store';

	activePage.set('history');

	let history: VideoPlay[] = [];
	let loaded = false;

	async function loadPageHistory(page: number = 1) {
		const videoIds = await getHistory(page);
		let promises = [];
		for (const videoId of videoIds) {
			promises.push(getVideo(videoId));
		}
		history = [...history, ...(await Promise.all(promises))];
	}

	onMount(async () => {
		await loadPageHistory();
		loaded = true;
	});
</script>

<VideoList videos={history} />
