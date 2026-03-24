<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { proxyGoogleImage } from '$lib/images';
	import { avatarFromChannelId } from '$lib/thumbnail';
	import { mergeAttrs } from 'melt';
	import { Avatar } from 'melt/builders';
	import { onMount } from 'svelte';

	let { author, authorId }: { author: string; authorId: string } = $props();

	let avatarSrc = $state('');
	const avatar = new Avatar({
		src: () => avatarSrc
	});

	onMount(() => {
		avatarFromChannelId(authorId).then((src) => {
			if (src) avatarSrc = proxyGoogleImage(src);
		});
	});
</script>

<img class="circle small" {...avatar.image} alt="Channel profile" />
<button
	class="circle secondary-container"
	onclick={() => {
		goto(resolve('/channel/[authorId]', { authorId }));
	}}
	{...mergeAttrs(avatar.fallback, {
		style: 'text-transform: uppercase;border-radius: 2.5rem !important;'
	})}>{author[0]}</button
>
