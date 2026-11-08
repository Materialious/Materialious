<script lang="ts">
	import { resolve } from '$app/paths';
	import { deleteUnsubscribe } from '#lib/api/index';
	import Fuse from 'fuse.js';
	import { _ } from '#lib/i18n/index';
	import NoResults from '#lib/components/NoResults.svelte';
	import AuthorAvatar from '#lib/components/AuthorAvatar.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let { data } = $props();

	let subscriptions = $state(structuredClone(data.subscriptions));

	let search: string = $state('');
	let multipleActions = $state(false);
	const selectedIds = new SvelteSet<string>();
	let selectedSubscriptions = $derived(
		subscriptions.filter((sub) => selectedIds.has(sub.authorId))
	);

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

	function toggleSelection(authorId: string) {
		if (selectedIds.has(authorId)) selectedIds.delete(authorId);
		else selectedIds.add(authorId);
	}

	function clearSelection() {
		selectedIds.clear();
	}

	function handleCardClick(event: MouseEvent, authorId: string) {
		if (!multipleActions || (event.target as HTMLElement).closest('a, button')) return;
		toggleSelection(authorId);
	}

	function handleCardKeydown(event: KeyboardEvent, authorId: string) {
		if (!multipleActions || (event.key !== 'Enter' && event.key !== ' ')) return;
		if ((event.target as HTMLElement).closest('a, button')) return;
		event.preventDefault();
		toggleSelection(authorId);
	}

	function finishSelection() {
		multipleActions = false;
		clearSelection();
	}

	async function unsubscribeSelected() {
		const results = await Promise.allSettled(
			selectedSubscriptions.map((sub) => deleteUnsubscribe(sub.authorId))
		);
		const removedIds = new Set(
			results.flatMap((result, index) =>
				result.status === 'fulfilled' ? [selectedSubscriptions[index].authorId] : []
			)
		);
		subscriptions = subscriptions.filter((sub) => !removedIds.has(sub.authorId));
		finishSelection();
	}
</script>

{#if subscriptions.length > 0}
	<div class="padding">
		<div class="search-actions">
			<div class="field prefix fill no-margin search round">
				<i class="front">search</i><input
					bind:value={search}
					oninput={searchSubs}
					type="text"
					placeholder={$_('searchPlaceholder')}
				/>
			</div>
			<button
				class="surface-container-highest round"
				aria-label="Bulk actions"
				aria-pressed={multipleActions}
				onclick={() => {
					multipleActions = !multipleActions;
					clearSelection();
				}}
			>
				<i>checklist</i><span class="m l">Bulk actions</span>
			</button>
		</div>
		{#if multipleActions}
			<div class="bulk-actions surface-container" role="toolbar" aria-label="Bulk actions">
				<div class="bulk-header">
					<div class="bulk-title">
						<strong>Bulk actions</strong><span>{selectedIds.size} selected</span>
					</div>
					<button
						class="surface-container-highest"
						onclick={() => {
							const allSelected = subscriptions.every((sub) => selectedIds.has(sub.authorId));
							clearSelection();
							if (!allSelected) {
								for (const sub of subscriptions) selectedIds.add(sub.authorId);
							}
						}}
					>
						{subscriptions.every((sub) => selectedIds.has(sub.authorId))
							? 'Deselect all'
							: 'Select all'}
					</button>
				</div>
				{#if selectedIds.size > 0}
					<div class="bulk-controls">
						<button class="surface-container-highest" onclick={unsubscribeSelected}>
							<i>person_remove</i>
							Unsubscribe selected
						</button>
					</div>
				{/if}
			</div>
		{/if}
		{#each subscriptions as sub (sub.authorId)}
			<article
				class:selected={multipleActions && selectedIds.has(sub.authorId)}
				class:selectable={multipleActions}
				role={multipleActions ? 'button' : undefined}
				aria-pressed={multipleActions ? selectedIds.has(sub.authorId) : undefined}
				tabindex={multipleActions ? 0 : undefined}
				onclick={(event) => handleCardClick(event, sub.authorId)}
				onkeydown={(event) => handleCardKeydown(event, sub.authorId)}
			>
				<nav>
					<AuthorAvatar author={sub.author} authorId={sub.authorId} />

					<a href={resolve('/(app)/channel/[slug]', { slug: sub.authorId })}
						><h6>
							{sub.author}
						</h6></a
					>
					<div class="max"></div>
					{#if !multipleActions}
						<button
							onclick={async () => unsubscribe(sub.authorId)}
							class="surface-container-highest">Unsubscribe</button
						>
					{/if}
				</nav>
			</article>
		{/each}
	</div>
{:else}
	<NoResults />
{/if}

<style>
	.search-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.search-actions .search {
		flex: 1;
		min-width: 0;
		--_background: var(--surface-container-highest);
	}
	.search-actions > button {
		flex: 0 0 auto;
		margin: 0;
	}
	.bulk-actions {
		margin: 0.5rem 0 1rem;
		padding: 1rem;
		border-radius: 1rem;
	}
	.bulk-header,
	.bulk-title,
	.bulk-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.bulk-header {
		justify-content: space-between;
	}
	.bulk-title span {
		font-size: 0.9em;
		opacity: 0.75;
	}
	.bulk-controls {
		margin-top: 0.75rem;
	}
	article.selected {
		border: 2px solid var(--primary);
	}
	article.selectable {
		cursor: pointer;
	}
	@media screen and (max-width: 590px) {
		.search-actions {
			gap: 0.5rem;
		}
		.search-actions > button span {
			display: none;
		}
		nav {
			flex-direction: column;
		}
	}
</style>
