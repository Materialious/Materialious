<script lang="ts">
	import type { Channel } from './Api/model';
	import { cleanNumber, truncate } from './misc';

	export let channel: Channel;
</script>

<a href={`/channel/${channel.authorId}`}>
	<div class="padding">
		<div class="center-align">
			<img
				class="circle"
				style="width: 90px;height: 90px;"
				src={channel.authorThumbnails[0].url}
				alt={channel.author}
			/>
		</div>
		<h5 class="center-align">{truncate(channel.author, 14)}</h5>
		<h6 style="margin-top: 0;" class="center-align grey-text medium-text">
			{cleanNumber(channel.subCount)} subscribers
		</h6>
		<p>{channel.description}</p>
	</div>
</a>
