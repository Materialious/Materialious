<script lang="ts">
	import { cleanNumber } from '$lib/numbers';
	import { _ } from '$lib/i18n';
	import type { HashTag } from '../api/model';
	import { truncate } from '../misc';

	interface Props {
		hashtag: HashTag;
	}

	let { hashtag }: Props = $props();
</script>

<a href={hashtag.url} class="wave" style="min-width: 100%;min-height: 100%;">
	<div class="padding">
		<h5 class="center-align">{truncate(hashtag.title, 14)}</h5>
		<h6 style="margin-top: 0;" class="center-align grey-text medium-text">
			{cleanNumber(hashtag.channelCount)}
			{$_('channels')}
		</h6>
		<h6 style="margin-top: 0;" class="center-align grey-text medium-text">
			{cleanNumber(hashtag.videoCount)}
			{$_('videos')}
		</h6>
	</div>
</a>
