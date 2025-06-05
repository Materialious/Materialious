<script lang="ts">
	import { deleteUnsubscribe } from '$lib/api';
	import Fuse from 'fuse.js';
	import { _ } from '$lib/i18n';

	let { data } = $props();

	let subscriptions = $state(structuredClone(data.subscriptions));

	let search: string = $state('');

	const fuse = new Fuse(subscriptions, {
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
		} catch {}
	}
</script>

<div class="space"></div>

<div class="max field round suffix prefix small no-margin surface-variant">
	<i class="front">search</i><input
		bind:value={search}
		oninput={searchSubs}
		type="text"
		placeholder={$_('searchPlaceholder')}
	/>
</div>

{#each subscriptions as sub}
	<article>
		<nav>
			<a href={`/channel/${sub.authorId}`}
				><h6>
					{sub.author}
				</h6></a
			>
			<div class="max"></div>
			<button onclick={async () => unsubscribe(sub.authorId)} class="border">Unsubscribe</button>
		</nav>
	</article>
{/each}

<style>
	@media screen and (max-width: 590px) {
		nav {
			flex-direction: column;
		}
	}
</style>
