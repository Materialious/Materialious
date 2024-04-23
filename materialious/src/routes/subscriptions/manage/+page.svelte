<script lang="ts">
	import { deleteUnsubscribe } from '$lib/Api';
	import { truncate } from '$lib/misc';
	import Fuse from 'fuse.js';
	import { _ } from 'svelte-i18n';
	import { activePageStore } from '../../../store';

	activePageStore.set(null);

	export let data;

	let subscriptions = structuredClone(data.subscriptions);

	let search: string;

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

<div class="max field round suffix prefix small no-margin white black-text">
	<i class="front">search</i><input
		bind:value={search}
		on:input={searchSubs}
		type="text"
		placeholder={$_('searchPlaceholder')}
	/>
</div>

{#each subscriptions as sub}
	<article>
		<nav>
			<a href={`/channel/${sub.authorId}`}><h6>{truncate(sub.author, 18)}</h6></a>
			<div class="max"></div>
			<button on:click={async () => unsubscribe(sub.authorId)} class="border">Unsubscribe</button>
		</nav>
	</article>
{/each}
