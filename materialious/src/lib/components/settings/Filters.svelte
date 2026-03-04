<script lang="ts">
	import { loadContentFilterFromURL } from '$lib/filtering';
	import { _ } from '$lib/i18n';
	import { filterContentListStore } from '$lib/store';

	let remoteFilterListUrl: string = $state('');
	let remoteError: string = $state('');

	async function loadFilterList(event: Event) {
		event.preventDefault();

		remoteError = '';

		if (!remoteFilterListUrl) {
			remoteError = 'No URL specified';
			return;
		}

		try {
			await loadContentFilterFromURL(remoteFilterListUrl);
		} catch (errorMsg) {
			remoteError = (errorMsg as Error).message;
		}
	}
</script>

<form onsubmit={loadFilterList}>
	<nav>
		<div
			class="field prefix label surface-container-highest max"
			class:invalid={remoteError !== ''}
		>
			<i>link</i>
			<input tabindex="0" bind:value={remoteFilterListUrl} name="remote-url" type="text" />
			<label tabindex="-1" for="remote-url">{$_('layout.filter.url')}</label>
			{#if remoteError !== ''}
				<span class="error">{remoteError}</span>
			{/if}
		</div>
		<button class="circle">
			<i>done</i>
		</button>
	</nav>
</form>

{#if $filterContentListStore}
	{#each $filterContentListStore as filter, index (index)}
		<article class="no-margin surface-container-highest">
			<h6>{filter.type}</h6>
			<ul class="list">
				{#each filter.conditions as condition, index (index)}
					<li>
						<p>
							<code>{condition.field}</code>
							<b>{condition.operator.replace('gt', 'greater then').replace('lt', 'less then')}</b>
							<code>{condition.value}</code>
						</p>
					</li>
					{#if index < filter.conditions.length - 1}
						<li>
							<p>{filter.operator}</p>
						</li>
					{/if}
				{/each}
			</ul>
		</article>
		<div class="small-space"></div>
	{/each}
{/if}

<button class="surface-container-highest">
	<i>add</i>
	<span>Add filter</span>
</button>
