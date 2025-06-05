<script lang="ts">
	import { deleteAllVideoProgress, deleteHistory, getHistory, getVideo } from '$lib/api';
	import type { VideoPlay } from '$lib/api/model';
	import PageLoading from '$lib/components/PageLoading.svelte';
	import VideoList from '$lib/components/VideoList.svelte';
	import { synciousStore } from '$lib/store';
	import { error } from '@sveltejs/kit';
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import { get } from 'svelte/store';

	let history: VideoPlay[] = $state([]);
	let loaded = $state(false);

	let currentPage = 1;

	async function loadPageHistory() {
		try {
			const videoIds = await getHistory(currentPage, 20);
			let promises = [];
			for (const videoId of videoIds) {
				promises.push(
					getVideo(videoId).catch(() => {
						return null;
					})
				);
			}

			const loadedHistory = (await Promise.all(promises)).filter((item) => {
				return item !== null;
			}) as VideoPlay[];
			history = [...history, ...loadedHistory];
		} catch (errorMessage: any) {
			error(500, errorMessage);
		}
	}

	async function loadMore(event: InfiniteEvent) {
		const pastHistoryLen = Number(history.length);

		currentPage++;

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
		onclick={async () => {
			await deleteHistory();

			if (get(synciousStore)) {
				deleteAllVideoProgress();
			}

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
