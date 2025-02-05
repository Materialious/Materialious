<script lang="ts">
	import VideoList from '$lib/components/VideoList.svelte';
	import { activePageStore } from '$lib/store';

	let { data } = $props();

	activePageStore.set('trending');
</script>

<VideoList videos={data.trending} />
