<script lang="ts">
	import { loadContentFilterFromURL, zFilterGroup, zFilterOperatorEnum } from '$lib/filtering';
	import { ChannelSchema, VideoSchema, type SchemaStructure } from '$lib/filtering/schemas';
	import { _ } from '$lib/i18n';
	import { titleCase, camelCaseToHuman } from '$lib/letterCasing';
	import { filterContentListStore } from '$lib/store';
	import type z from 'zod';

	let remoteFilterListUrl: string = $state('');
	let remoteError: string = $state('');

	type FilterType = 'channel' | 'video';

	const filterTypes: FilterType[] = ['channel', 'video'];

	const schema: Record<FilterType, SchemaStructure> = {
		channel: ChannelSchema,
		video: VideoSchema
	};

	let contentFilters = $state($filterContentListStore);

	async function loadFilterList(event: Event) {
		event.preventDefault();

		remoteError = '';

		if (!remoteFilterListUrl) {
			remoteError = 'No URL specified';
			return;
		}

		try {
			contentFilters = await loadContentFilterFromURL(remoteFilterListUrl);
			filterContentListStore.set(contentFilters);
		} catch (errorMsg) {
			remoteError = (errorMsg as Error).message;
		}
	}

	function addFilter(type: FilterType) {
		if (!contentFilters) contentFilters = [];

		contentFilters.push({
			conditions: [],
			type
		});

		filterContentListStore.set(contentFilters);
	}

	function removeFilter(filter: z.infer<typeof zFilterGroup>) {
		if (!contentFilters) contentFilters = [];

		contentFilters = contentFilters.filter((item) => item !== filter);

		filterContentListStore.set(contentFilters);
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

{#if contentFilters}
	{#each contentFilters as filter (filter)}
		<article class="no-margin surface-container-high">
			<div class="grid">
				<div class="s12 m6 l6">
					<div class="label field suffix surface-container-highest">
						<select name="content-type">
							{#each filterTypes as filterType (filterType)}
								<option selected={filterType === filter.type} value={filterType}
									>{titleCase(filterType)}</option
								>
							{/each}
						</select>
						<label for="content-type">Content type</label>
						<i>arrow_drop_down</i>
					</div>
				</div>
				<div class="s12 m6 l6 right-align">
					<button onclick={() => removeFilter(filter)} class="surface-container-highest">
						<i>close</i>
					</button>
				</div>
			</div>
			<div class="space"></div>
			<hr />
			{#if filter.conditions}
				<ul class="list">
					{#each filter.conditions as condition (condition)}
						<li style="display: block;">
							<nav class="right-align no-margin">
								<button
									onclick={() => {
										filter.conditions = filter.conditions.filter((item) => condition !== item);
										filterContentListStore.set(contentFilters);
									}}
									class="surface-container-highest"
								>
									<i>close</i>
								</button>
							</nav>

							<div class="label field suffix surface-container-highest">
								<select
									onchange={(event: Event & { currentTarget: HTMLSelectElement }) => {
										condition.field = event.currentTarget.value;
										filterContentListStore.set(contentFilters);
									}}
									name="field"
								>
									{#each Object.keys(schema[filter.type]) as key (key)}
										<option value={key} selected={condition.field === key}
											>{camelCaseToHuman(key)}</option
										>
									{/each}
								</select>
								<label for="field">Field</label>
								<i>arrow_drop_down</i>
							</div>

							<div class="field label suffix surface-container-highest">
								<select
									onchange={(event: Event & { currentTarget: HTMLSelectElement }) => {
										condition.operator = event.currentTarget.value as z.infer<
											typeof zFilterOperatorEnum
										>;
										filterContentListStore.set(contentFilters);
									}}
									name="operator"
								>
									{#each zFilterOperatorEnum.options as operator (operator)}
										<option selected={operator === condition.operator} value={operator}
											>{operator}</option
										>
									{/each}
								</select>
								<label for="operator">Operator</label>
								<i>arrow_drop_down</i>
							</div>

							{#if schema[filter.type][condition.field] === 'boolean'}
								<div class="field label suffix surface-container-highest">
									<select
										onchange={(event: Event & { currentTarget: HTMLSelectElement }) => {
											condition.value = event.currentTarget.value;
											filterContentListStore.set(contentFilters);
										}}
										name="boolean-options"
									>
										<option value="" disabled selected>Select your option</option>
										<option value="true">true</option>
										<option value="false">false</option>
									</select>
									<label for="boolean-options">Value</label>
									<i>arrow_drop_down</i>
								</div>
							{:else if Array.isArray(schema[filter.type][condition.field])}
								<div class="field label suffix surface-container-highest">
									<select
										onchange={(event: Event & { currentTarget: HTMLSelectElement }) => {
											condition.value = event.currentTarget.value;
											filterContentListStore.set(contentFilters);
										}}
										name="array-options"
									>
										<option value="" disabled selected>Select your option</option>
										{#each schema[filter.type][condition.field] as value (value)}
											<option {value}>{camelCaseToHuman(value)}</option>
										{/each}
									</select>
									<label for="array-options">Value</label>
									<i>arrow_drop_down</i>
								</div>
							{:else}
								<div class="field label border">
									<input
										oninput={(event: Event & { currentTarget: HTMLInputElement }) => {
											condition.value = event.currentTarget.value;
											filterContentListStore.set(contentFilters);
										}}
										name="value"
										type={schema[filter.type][condition.field] === 'string' ? 'text' : 'number'}
										value={condition.value}
									/>
									<label for="value">Value</label>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			<div class="small-space"></div>
			<button
				onclick={() => {
					filter.conditions.push({
						operator: 'equals',
						field: 'author',
						value: ''
					});
				}}
				class="surface-container-highest"
			>
				<i>add</i>
				<span>Add conditional</span>
			</button>
		</article>
		<div class="small-space"></div>
	{/each}
{/if}

<div>
	<button class="surface-container-highest">
		<i>add</i>
		<span>Add filter</span>
	</button>
	<menu class="min">
		{#each filterTypes as filterType (filterType)}
			<li role="presentation" onclick={() => addFilter(filterType)}>{titleCase(filterType)}</li>
		{/each}
	</menu>
</div>
