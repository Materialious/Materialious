<script lang="ts">
	import { getSearch } from '$lib/Api';
	import VideoList from '$lib/VideoList.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { activePage } from '../../../store';

	export let data;

	let currentPage = 1;

	let search = data.search;

	activePage.set(null);

	async function handleScroll() {
		const { scrollTop, clientHeight, scrollHeight } = document.documentElement;
		if (scrollTop + clientHeight >= scrollHeight - 5) {
			currentPage += 1;
			search = [...search, ...(await getSearch(data.slug, { page: currentPage.toString() }))];
		}
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll);
	});

	onDestroy(() => {
		window.removeEventListener('scroll', handleScroll);
	});
</script>

<VideoList videos={search} />
