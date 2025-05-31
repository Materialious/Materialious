<script lang="ts">
	import VideoList from '$lib/components/VideoList.svelte';

	let { data } = $props();
</script>

<VideoList videos={data.trending} />
