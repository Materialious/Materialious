<script lang="ts">
	import { onMount } from 'svelte';
	import type { Channel } from './Api/model';
	import { cleanNumber, truncate } from './misc';

	export let channel: Channel;

	let loading = true;
	let loaded = false;
	let failed = false;

	let img: HTMLImageElement;

	onMount(() => {
		img = new Image();
		img.src = channel.authorThumbnails[0].url;

		img.onload = () => {
			loaded = true;
			loading = false;
		};
		img.onerror = () => {
			loading = false;
			failed = true;
		};
	});
</script>

<a href={`/channel/${channel.authorId}`} class="wave" style="min-width: 100%;min-height: 100%;">
	<div class="padding">
		<div class="center-align">
			{#if loading}
				<progress class="circle"></progress>
			{:else}
				<img class="circle" style="width: 90px;height: 90px;" src={img.src} alt={channel.author} />
			{/if}
		</div>
		<h5 class="center-align">{truncate(channel.author, 14)}</h5>
		<h6 style="margin-top: 0;" class="center-align grey-text medium-text">
			{cleanNumber(channel.subCount)} subscribers
		</h6>
		<p>{channel.description}</p>
	</div>
</a>
