<script lang="ts">
	import Player from '$lib/components/Player.svelte';
	import type { MediaPlayerElement } from 'vidstack/elements';

	export let data;

	let player: MediaPlayerElement;
</script>

<Player bind:player isEmbed={true} {data} />
