<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import PageLoading from '$lib/PageLoading.svelte';
	import { onMount } from 'svelte';
	import { auth } from '../../store';

	onMount(() => {
		auth.set({
			username: $page.url.searchParams.get('username') as string,
			token: $page.url.searchParams.get('token') as string
		});

		goto('/');
	});
</script>

<PageLoading />
