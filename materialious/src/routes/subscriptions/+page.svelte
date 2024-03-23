<script lang="ts">
	import { getFeed } from '$lib/Api/index.js';
	import VideoList from '$lib/VideoList.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { activePage } from '../../store.js';

	export let data;

	let currentPage = 1;
	let videos = [...data.feed.videos, ...data.feed.notifications];

	activePage.set('subscriptions');

	async function handleScroll() {
		const { scrollTop, clientHeight, scrollHeight } = document.documentElement;
		if (scrollTop + clientHeight >= scrollHeight - 5) {
			currentPage += 1;
			const feed = await getFeed(100, currentPage);
			videos = [...videos, ...feed.notifications];
		}
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll);
	});

	onDestroy(() => {
		window.removeEventListener('scroll', handleScroll);
	});
</script>

<VideoList bind:videos />
