<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import PageLoading from '$lib/components/PageLoading.svelte';
	import { invidiousAuthStore } from '$lib/store';
	import { onMount } from 'svelte';

	// Auth response handling for Desktop
	onMount(() => {
		const username = $page.url.searchParams.get('username');
		const token = $page.url.searchParams.get('token');

		if (username && token) {
			invidiousAuthStore.set({
				username: username,
				token: token
			});
		}

		goto(resolve('/', {}));
	});
</script>

<PageLoading />
