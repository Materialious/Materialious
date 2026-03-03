<script lang="ts">
	import { resolve } from '$app/paths';
	import { getBestThumbnail, proxyGoogleImage } from '$lib/images';
	import { cleanNumber } from '$lib/numbers';
	import { _ } from '$lib/i18n';
	import type { Channel } from '$lib/api/model';
	import { truncate } from '$lib/misc';
	import { Avatar } from 'melt/builders';
	import { mergeAttrs } from 'melt';

	interface Props {
		channel: Channel;
	}

	let { channel }: Props = $props();

	const avatar = new Avatar({ src: proxyGoogleImage(getBestThumbnail(channel.authorThumbnails)) });
</script>

<a
	href={resolve(`/channel/[authorId]`, { authorId: channel.authorId })}
	class="wave"
	style="min-width: 100%;min-height: 100%;"
>
	<div class="padding">
		<div class="center-align">
			<img
				{...avatar.image}
				class="circle"
				style="width: 90px;height: 90px;"
				alt={channel.author}
			/>
			<button
				class="secondary-container large"
				{...mergeAttrs(avatar.fallback, {
					style: 'text-transform: uppercase;border-radius: 2.5rem !important;'
				})}>{channel.author[0]}</button
			>
		</div>
		<h5 class="center-align">{truncate(channel.author, 14)}</h5>
		<h6 style="margin-top: 0;" class="center-align grey-text medium-text">
			{cleanNumber(channel.subCount)}
			{$_('subscribers')}
		</h6>
		<p>{channel.description}</p>
	</div>
</a>
