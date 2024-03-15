<script lang="ts">
	import VideoList from '$lib/VideoList.svelte';
	import { activePage } from '../store.js';

	export let data;

	activePage.set('home');
</script>

<VideoList videos={data.popular} />
