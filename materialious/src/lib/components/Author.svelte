<script lang="ts">
	import { resolve } from '$app/paths';
	import { amSubscribed, deleteUnsubscribe, postSubscribe } from '$lib/api';
	import type { Image } from '$lib/api/model';
	import { getBestThumbnail, proxyGoogleImage } from '$lib/images';
	import { isYTBackend, truncate } from '$lib/misc';
	import { authStore, interfaceLowBandwidthMode, isAndroidTvStore } from '$lib/store';
	import { _ } from '$lib/i18n';
	import { localDb } from '$lib/dexie';
	import { onMount } from 'svelte';

	let {
		channel,
		hideSubscribe = false
	}: {
		channel: { authorId: string; subCountText: string; authorThumbnails: Image[]; author: string };
		hideSubscribe?: boolean;
	} = $props();

	let favoritedChannel = $state(false);
	let subscribed = $state(false);

	const favoriteChannelItem = localDb.favouriteChannels.filter((item) => {
		return item.channelId === channel.authorId;
	});

	onMount(async () => {
		amSubscribed(channel.authorId).then((subbed) => (subscribed = subbed));

		favoritedChannel = (await favoriteChannelItem.count()) > 0;
	});

	async function toggleSubscribed() {
		if (subscribed) {
			await deleteUnsubscribe(channel.authorId);
		} else {
			await postSubscribe(channel.authorId);
		}

		subscribed = !subscribed;
	}

	async function toggleFavourited() {
		if (favoritedChannel) {
			await favoriteChannelItem.delete();
			favoritedChannel = false;
		} else {
			await localDb.favouriteChannels.add({ channelId: channel.authorId, created: new Date() });
			favoritedChannel = true;
		}
	}
</script>

<nav>
	<a href={resolve(`/channel/[authorId]`, { authorId: channel.authorId })}>
		<nav style="gap: 0.5em;">
			{#if !$interfaceLowBandwidthMode}
				<img
					loading="lazy"
					class="circle large"
					src={proxyGoogleImage(getBestThumbnail(channel.authorThumbnails))}
					alt="Channel profile"
				/>
			{/if}
			<div>
				<p style="margin: 0;" class="bold">
					{$isAndroidTvStore ? channel.author : truncate(channel.author, 16)}
				</p>
				<p style="margin: 0;">{channel.subCountText}</p>
			</div>
		</nav>
	</a>
	{#if !hideSubscribe}
		{#if $authStore || isYTBackend()}
			<nav class="group split">
				<button
					onclick={toggleSubscribed}
					class:inverse-surface={!subscribed}
					class:border={subscribed}
				>
					{#if !subscribed}
						{$_('subscribe')}
					{:else}
						{$_('unsubscribe')}
					{/if}
				</button>
				{#if window.indexedDB && subscribed}
					<button
						class:inverse-surface={!favoritedChannel}
						class:border={favoritedChannel}
						onclick={toggleFavourited}
						class="square"
					>
						<i>star</i>
						<div class="tooltip">
							{favoritedChannel ? $_('unfavouriteChannel') : $_('favouriteChannel')}
						</div>
					</button>
				{/if}
			</nav>
		{:else}
			<button class="inverse-surface" disabled>
				{$_('subscribe')}
				<div class="tooltip">
					{$_('loginRequired')}
				</div>
			</button>
		{/if}
	{/if}
</nav>
