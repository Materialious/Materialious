<script lang="ts">
	import { resolve } from '$app/paths';
	import { deleteUnsubscribe } from '$lib/api';
	import Fuse from 'fuse.js';
	import { _ } from '$lib/i18n';
	import NoResults from '$lib/components/NoResults.svelte';

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
</script>

{#if subscriptions.length > 0}
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
			<article>
				<nav>
					<a href={resolve(`/channel/[authorId]`, { authorId: sub.authorId })}
						><h6>
							{sub.author}
						</h6></a
					>
					<div class="max"></div>
					<button onclick={async () => unsubscribe(sub.authorId)} class="border">Unsubscribe</button
					>
				</nav>
			</article>
		{/each}
	</div>
{:else}
	<NoResults />
{/if}

<style>
	@media screen and (max-width: 590px) {
		nav {
			flex-direction: column;
		}
	}
</style>
