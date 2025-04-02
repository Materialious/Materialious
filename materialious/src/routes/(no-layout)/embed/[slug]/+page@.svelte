<script lang="ts">
	import Player from '$lib/components/Player.svelte';

	let { data } = $props();

	let playerElement: HTMLMediaElement;
</script>

<Player bind:playerElement isEmbed={true} {data} />
