<script lang="ts">
	import VideoList from '$lib/VideoList.svelte';
	import { activePage } from '../../store.js';

	export let data;

	activePage.set('trending');
</script>

<VideoList videos={data.trending} />
