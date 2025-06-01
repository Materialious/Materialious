<script lang="ts">
	import VideoList from '$lib/components/VideoList.svelte';
	import { feedCacheStore } from '$lib/store';
</script>

<VideoList videos={$feedCacheStore.trending ?? []} />
