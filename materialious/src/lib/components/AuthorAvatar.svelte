<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { imageHandleCors, proxyGoogleImage } from '#lib/images';
	import { avatarFromChannelId } from '#lib/thumbnail';
	import { mergeAttrs } from 'melt';
	import { Avatar } from 'melt/builders';
	
	let { author, authorId }: { author: string; authorId: string } = $props();

	let avatarSrc = $state('');
	const avatar = new Avatar({
		src: () => avatarSrc
	});

	$effect(() => {
		const id = authorId;
		let active = true;
		avatarSrc = '';
		avatarFromChannelId(id)
			.then((src) => imageHandleCors(src ? proxyGoogleImage(src) : ''))
			.then((src) => {
				if (active) avatarSrc = src;
			})
			.catch(() => {
				if (active) avatarSrc = '';
			});
		return () => {
			active = false;
		};
	});

	function goToChannel() {
		goto(resolve('/(app)/channel/[slug]', { slug: authorId }));
	}
</script>

<img
	class="circle small"
	{...mergeAttrs(avatar.image, { onclick: goToChannel })}
	alt="Channel profile"
	tabindex="-1"
/>
<button
	class="circle secondary-container"
	tabindex="-1"
	onclick={goToChannel}
	{...mergeAttrs(avatar.fallback, {
		style: 'text-transform: uppercase;border-radius: 2.5rem !important;'
	})}>{author[0]}</button
>
