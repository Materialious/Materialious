<script lang="ts">
	import { getBestThumbnail, proxyGoogleImage } from '$lib/images';
	import { cleanNumber } from '$lib/numbers';
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import type { Channel } from '../api/model';
	import { insecureRequestImageHandler, truncate } from '../misc';
	import { interfaceLowBandwidthMode } from '../store';

	interface Props {
		channel: Channel;
	}

	let { channel }: Props = $props();

	let channelPfp: HTMLImageElement | undefined = $state();

	onMount(async () => {
		if (get(interfaceLowBandwidthMode)) return;

		const img = await insecureRequestImageHandler(
			proxyGoogleImage(getBestThumbnail(channel.authorThumbnails))
		);
		img.onload = () => {
			channelPfp = img;
		};
	});
</script>

<a href={`/channel/${channel.authorId}`} class="wave" style="min-width: 100%;min-height: 100%;">
	<div class="padding">
		{#if !$interfaceLowBandwidthMode}
			<div class="center-align">
				{#if !channelPfp}
					<progress class="circle"></progress>
				{:else}
					<img
						class="circle"
						style="width: 90px;height: 90px;"
						src={channelPfp.src}
						alt={channel.author}
					/>
				{/if}
			</div>
		{/if}
		<h5 class="center-align">{truncate(channel.author, 14)}</h5>
		<h6 style="margin-top: 0;" class="center-align grey-text medium-text">
			{cleanNumber(channel.subCount)}
			{$_('subscribers')}
		</h6>
		<p>{channel.description}</p>
	</div>
</a>
