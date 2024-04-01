<script lang="ts">
	import { deleteHistory, getHistory, getVideo } from '$lib/Api';
	import type { VideoPlay } from '$lib/Api/model';
	import VideoList from '$lib/VideoList.svelte';
	import { error } from '@sveltejs/kit';
	import { onDestroy, onMount } from 'svelte';
	import { activePage } from '../../store';

	activePage.set('history');

	let history: VideoPlay[] = [];
	let loaded = false;

	let currentPage = 1;

	async function loadPageHistory() {
		try {
			const videoIds = await getHistory(currentPage);
			let promises = [];
			for (const videoId of videoIds) {
				promises.push(getVideo(videoId));
			}

			const loadedHistory = await Promise.all(promises);
			history = [...history, ...loadedHistory];
		} catch (errorMessage: any) {
			error(500, errorMessage);
		}
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

<div style="display: flex;margin-top: 1em;" class="space">
	<button
		on:click={async () => {
			await deleteHistory();
			history = [];
			Object.keys(localStorage).forEach((key) => {
				if (key.startsWith('v_')) {
					localStorage.removeItem(key);
				}
			});
		}}
	>
		<i>delete_sweep</i>
		<span>Delete all history</span>
	</button>
</div>

<VideoList videos={history} />
