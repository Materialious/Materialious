<script lang="ts">
	import VideoList from '$lib/VideoList.svelte';
	import { activePage } from '../../../store';

	export let data;

	activePage.set(null);
</script>

<VideoList videos={data.search} />
