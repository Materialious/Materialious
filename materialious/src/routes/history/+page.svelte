<script lang="ts">
	import { deleteHistory, getHistory, getVideo } from '$lib/Api';
	import type { VideoPlay } from '$lib/Api/model';
	import PageLoading from '$lib/PageLoading.svelte';
	import VideoList from '$lib/VideoList.svelte';
	import { error } from '@sveltejs/kit';
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
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

	async function loadMore(event: InfiniteEvent) {
		const pastHistoryLen = Number(history.length);

		await loadPageHistory();

		if (pastHistoryLen === history.length) {
			event.detail.complete();
		} else {
			event.detail.loaded();
		}
	}

	onMount(async () => {
		await loadPageHistory();
		loaded = true;
	});
</script>

<div class="space"></div>
<nav class="right-align">
	<button
		on:click={async () => {
			await deleteHistory();
			history = [];
			try {
				Object.keys(localStorage).forEach((key) => {
					if (key.startsWith('v_')) {
						localStorage.removeItem(key);
					}
				});
			} catch {}
		}}
	>
		<i>delete_sweep</i>
		<span>{$_('deleteAllHistory')}</span>
	</button>
</nav>

{#if loaded}
	<VideoList videos={history} />

	<InfiniteLoading on:infinite={loadMore} />
{:else}
	<PageLoading />
{/if}
