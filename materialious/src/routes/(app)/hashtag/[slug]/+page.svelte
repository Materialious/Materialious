<script lang="ts">
	import VideoList from '$lib/VideoList.svelte';

	export let data;
</script>

<VideoList videos={data.hashTagVideos.results} />
