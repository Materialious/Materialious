<script lang="ts">
	import { resolve } from '$app/paths';
	import { deleteUnsubscribe } from '$lib/api';
	import { type Image } from '$lib/api/model';
	import Fuse from 'fuse.js';
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n';

	let { data } = $props();

	let subscriptions = $state(structuredClone(data.subscriptions));

	let search: string = $state('');

	const fuse = new Fuse(data.subscriptions, {
		keys: ['author']
	});

	function searchSubs() {
		if (search === '') {
			subscriptions = structuredClone(data.subscriptions);
		} else {
			subscriptions = fuse.search(search).map((item) => item.item);
		}
	}

	async function unsubscribe(authorId: string) {
		try {
			await deleteUnsubscribe(authorId);
			subscriptions = subscriptions.filter((item) => {
				return item.authorId !== authorId;
			});
		} catch {
			// Continue regradless of error
		}
	}

	function closestByWidth(images: Image[], targetWidth: number): Image | undefined {
		if (!images?.length) return undefined;
		return images.reduce((prev, curr) =>
			Math.abs(curr.width - targetWidth) < Math.abs(prev.width - targetWidth) ? curr : prev
		);
	}

	// Reactive viewport width
	let pageWidth = 0;
	const updateWidth = () => pageWidth = window.innerWidth;
	onMount(() => {
		updateWidth();
		window.addEventListener('resize', updateWidth);
		return () => window.removeEventListener('resize', updateWidth);
	});

	function lazyBg(node: HTMLElement, src?: string) {
		let obs: IntersectionObserver | null = null;

		const observe = (url?: string) => {
		if (obs) {
			obs.disconnect();
			obs = null;
		}
		if (!url) {
			node.style.backgroundImage = '';
			return;
		}

		obs = new IntersectionObserver((entries, o) => {
			if (entries[0].isIntersecting) {
				node.style.backgroundImage = `url(${url})`;
				o.unobserve(node);
			}
		});
			obs.observe(node);
		};

		observe(src);
		return {
			update(newSrc?: string) {
				observe(newSrc); 
			},
			destroy() {
				if (obs) obs.disconnect();
			}
		};
	}
</script>

<div class="padding">
	<div class="max field suffix prefix small no-margin surface-variant">
		<i class="front">search</i><input
			bind:value={search}
			oninput={searchSubs}
			type="text"
			placeholder={$_('searchPlaceholder')}
		/>
	</div>

	{#each subscriptions as sub (sub.authorId)}
		<article
			use:lazyBg={closestByWidth(sub.authorBanners, pageWidth)?.url}
			class="subscription-article lazy-bg"
		>
			<div class="banner-overlay"></div>

			<nav class="flex gap-1 items-center m-0">
				<a href={resolve(`/channel/[authorId]`, { authorId: sub.authorId })} class="flex items-center gap-1">
					<img 
						src={closestByWidth(sub.authorThumbnails, 64)?.url} 
						alt={sub.author} 
						class="sub-thumbnail rounded-circle"
						loading="lazy"
					/>
					<h6 class="m-0">{sub.author}</h6>
				</a>

				<div class="max"></div>
				<button onclick={async () => unsubscribe(sub.authorId)} class="border overlay-button">
					Unsubscribe
				</button>
			</nav>
		</article>
	{/each}
</div>

<style>
	@media screen and (max-width: 590px) {
		nav {
			flex-direction: column;
		}
	}

	.overlay-button {
		position: relative;
		background-color: rgba(var(--outline-variant, 0,0,0), 0.3);
		backdrop-filter: blur(2px);
		transition: background-color 0.2s ease;
	}

	.overlay-button:hover {
		background-color: rgba(var(--outline-variant, 0,0,0), 0.5);
	}

	:is(.overlay-button,.button).border {
		border-color: var(--outline-variant);
		color: var(--primary);
	}

	.subscription-article {
		position: relative;
		background-size: cover;
		background-position: center;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1rem;
		color: white;
		overflow: hidden;
	}

	.banner-overlay {
		position: absolute;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.3);
		pointer-events: none;
	}

	.lazy-bg {
		background-color: var(--surface-container-low);
	}

	.sub-thumbnail {
		width: 64px;
		height: 64px;
		object-fit: cover;
		flex-shrink: 0;
		margin-right: 1em;
		border-radius: 50%;
	}

	.m-0 {
		margin: 0 !important;
	}
</style>
