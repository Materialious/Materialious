<script lang="ts">
	import { cleanNumber } from '$lib/misc';
	import Thumbnail from '$lib/Thumbnail.svelte';

	export let data;
</script>

<div class="padding">
	{#if data.channel.authorBanners.length > 0}
		<img src={data.channel.authorBanners[0].url} width="100%" alt="Channel banner" />
	{/if}
	<div class="description">
		<img
			style="margin-right: 1em;"
			class="circle extra m l"
			src={data.channel.authorThumbnails[5].url}
			alt="Channel profile"
		/>
		<div>
			<h2>{data.channel.author}</h2>
			<p>{cleanNumber(data.channel.subCount)} subscribers</p>
			<p style="width: 60vw;">{data.channel.description}</p>
		</div>
		<button class="inverse-surface large">Subscribe</button>
	</div>

	<div class="tabs left-align">
		{#each data.channel.tabs as tab}
			<a href={`?tab=${tab}`}>
				<span>{tab}</span>
			</a>
		{/each}
	</div>

	<div class="divider"></div>

	<div class="grid padding">
		{#each data.channel.latestVideos as video}
			<div class="s12 m6 l2">
				<Thumbnail {video} />
			</div>
		{/each}
	</div>
</div>

<style>
	.description {
		display: flex;
		padding: 1em 0;
		justify-content: center;
	}

	.tabs {
		text-transform: capitalize;
	}
</style>
