<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import PageLoading from '$lib/PageLoading.svelte';
	import { authStore } from '$lib/store';
	import { onMount } from 'svelte';

	// Auth response handling for Desktop
	onMount(() => {
		const username = $page.url.searchParams.get('username');
		const token = $page.url.searchParams.get('token');

		if (username && token) {
			authStore.set({
				username: username,
				token: token
			});
		}

		goto('/');
	});
</script>

<PageLoading />
