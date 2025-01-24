<script lang="ts">
	import VideoList from '$lib/components/VideoList.svelte';
	import { activePageStore } from '$lib/store';

	export let data;

	activePageStore.set('trending');
</script>

<VideoList videos={data.trending} />
