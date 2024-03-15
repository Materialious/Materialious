<script lang="ts">
	import VideoList from '$lib/VideoList.svelte';
	import { activePage } from '../../store.js';

	export let data;

	activePage.set('subscriptions');
</script>

<VideoList videos={[...data.feed.videos, ...data.feed.notifications]} />
