<script lang="ts">
	import Player from '$lib/Player.svelte';
	import type { MediaPlayerElement } from 'vidstack/elements';

	export let data;
	export let layout = false;

	let player: MediaPlayerElement;
</script>

<Player bind:player {data} />
