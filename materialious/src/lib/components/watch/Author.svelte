<script lang="ts">
	import { deleteUnsubscribe, postSubscribe } from '$lib/api';
	import type { VideoPlay } from '$lib/api/model';
	import { getBestThumbnail, proxyGoogleImage } from '$lib/images';
	import { truncate } from '$lib/misc';
	import { authStore, interfaceLowBandwidthMode, isAndroidTvStore } from '$lib/store';
	import { _ } from '$lib/i18n';

	let {
		video,
		subscribed = $bindable(false),
		hideSubscribe = false
	}: { video: VideoPlay; subscribed?: boolean; hideSubscribe?: boolean } = $props();

	async function toggleSubscribed() {
		if (subscribed) {
			await deleteUnsubscribe(video.authorId);
		} else {
			await postSubscribe(video.authorId);
		}

		subscribed = !subscribed;
	}
</script>

<nav>
	<a href={`/channel/${video.authorId}`}>
		<nav style="gap: 0.5em;">
			{#if !$interfaceLowBandwidthMode}
				<img
					loading="lazy"
					class="circle large"
					src={proxyGoogleImage(getBestThumbnail(video.authorThumbnails))}
					alt="Channel profile"
				/>
			{/if}
			<div>
				<p style="margin: 0;" class="bold">
					{$isAndroidTvStore ? video.author : truncate(video.author, 16)}
				</p>
				<p style="margin: 0;">{video.subCountText}</p>
			</div>
		</nav>
	</a>
	{#if !hideSubscribe}
		{#if $authStore}
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
