<script lang="ts">
	import ItemsList from '$lib/components/ItemsList.svelte';
	import { feedCacheStore } from '$lib/store';
</script>

<ItemsList items={$feedCacheStore.trending ?? []} />
