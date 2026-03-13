<script lang="ts">
	import { loadContentFilterFromURL, zFilterGroup, zFilterOperatorEnum } from '$lib/filtering';
	import { ChannelSchema, VideoSchema, type SchemaStructure } from '$lib/filtering/schemas';
	import { _ } from '$lib/i18n';
	import { titleCase, camelCaseToHuman } from '$lib/letterCasing';
	import {
		filterContentListStore,
		filterContentUrlAutoUpdateStore,
		filterContentUrlStore
	} from '$lib/store';
	import type z from 'zod';
	import { addToast } from '../Toast.svelte';
	import { Clipboard } from '@capacitor/clipboard';
	import { downloadStringAsFile } from '$lib/misc';
	import ComboBox from '../ComboBox.svelte';

	let remoteFilterListUrl: string = $state($filterContentUrlStore ?? '');
	let remoteError: string = $state('');

	type FilterType = 'channel' | 'video';

	const filterTypes: FilterType[] = ['channel', 'video'];

	const schema: Record<FilterType, SchemaStructure> = {
		channel: ChannelSchema,
		video: VideoSchema
	};

	let contentFilters = $state($filterContentListStore);

	filterContentListStore.subscribe((updatedFilterList) => (contentFilters = updatedFilterList));

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
			filterContentUrlStore.set(remoteFilterListUrl);
			filterContentUrlAutoUpdateStore.set(false);
		} catch (errorMsg) {
			remoteError = (errorMsg as Error).message;
		}
	}

	function filtersAsJSON() {
		return JSON.stringify(
			{
				version: 'v2',
				createdFor: 'materialious',
				filterBy: contentFilters
			},
			null,
			2
		);
	}

	async function exportToClipboard() {
		await Clipboard.write({
			string: filtersAsJSON()
		});

		addToast({
			data: {
				text: $_('player.share.copiedSuccess')
			}
		});
	}

	function addFilter(type: FilterType) {
		if (!contentFilters) contentFilters = [];

		contentFilters.push({
			conditions: [],
			type
		});

		filterContentListStore.set(contentFilters);

		filterContentUrlAutoUpdateStore.set(false);
	}

	function removeFilter(filter: z.infer<typeof zFilterGroup>) {
		if (!contentFilters) contentFilters = [];

		contentFilters = contentFilters.filter((item) => item !== filter);

		filterContentListStore.set(contentFilters);
		filterContentUrlAutoUpdateStore.set(false);
	}
</script>

<article class="error-container">
	<p>{$_('layout.backendEngine.warning')}</p>
	<p>
		Need Help? Check out our <a
			class="link"
			href="https://github.com/Materialious/Materialious/blob/main/docs/CONTENT-FILTERS.md"
			target="_blank"
			referrerpolicy="no-referrer">guide</a
		>.
	</p>
</article>

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

{#if $filterContentUrlStore}
	<nav class="no-padding">
		<div class="max">
			<p>{$_('layout.filter.autoUpdate')}</p>
		</div>
		<label class="switch" tabindex="0">
			<input
				bind:checked={$filterContentUrlAutoUpdateStore}
				onclick={() => filterContentUrlAutoUpdateStore.set(!$filterContentUrlAutoUpdateStore)}
				type="checkbox"
				role="switch"
			/>
			<span></span>
		</label>
	</nav>
	<div class="space"></div>
{/if}

{#if contentFilters}
	{#if contentFilters.length > 0}
		<button class="surface-container-highest" onclick={exportToClipboard}>
			<i>content_copy</i>
			<span>{$_('layout.export.exportToClipboard')}</span>
		</button>
		<button
			class="surface-container-highest"
			onclick={() => downloadStringAsFile(filtersAsJSON(), 'materialious-filters.json')}
		>
			<i>content_copy</i>
			<span>{$_('layout.export.exportToFile')}</span>
		</button>
		<div class="space"></div>
	{/if}

	{#each contentFilters as filter (filter)}
		<article class="no-margin surface-container-high">
			<div class="grid">
				<div class="s12 m6 l6">
					<ComboBox
						label={$_('layout.filter.contentType')}
						defaultValue={filter.type}
						options={filterTypes.map((filterType) => {
							return {
								label: titleCase(filterType),
								value: filterType
							};
						})}
						onChange={(value) => {
							filter.type = value as 'channel' | 'video';
							filterContentListStore.set(contentFilters);
							filterContentUrlAutoUpdateStore.set(false);
						}}
					/>
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
					{#each filter.conditions as condition, conditionIndex (condition)}
						<li style="display: block;">
							<nav class="no-margin">
								<button
									onclick={() => {
										filter.conditions = filter.conditions.filter((item) => condition !== item);
										filterContentListStore.set(contentFilters);
										filterContentUrlAutoUpdateStore.set(false);
									}}
									class="surface-container-highest"
								>
									<i>close</i>
									<span>Delete conditional</span>
								</button>
							</nav>

							<div class="field label surface-container-highest">
								<input
									oninput={(event: Event & { currentTarget: HTMLInputElement }) => {
										condition.note = event.currentTarget.value;
										filterContentListStore.set(contentFilters);
										filterContentUrlAutoUpdateStore.set(false);
									}}
									name="note"
									type="text"
									value={condition.note}
								/>
								<label for="note">Note</label>
							</div>

							<ComboBox
								label={$_('layout.filter.field')}
								defaultValue={condition.field}
								options={Object.keys(schema[filter.type]).map((key) => {
									return {
										label: camelCaseToHuman(key),
										value: key
									};
								})}
								onChange={(value) => {
									condition.field = value;
									filterContentListStore.set(contentFilters);
									filterContentUrlAutoUpdateStore.set(false);
								}}
							/>

							<ComboBox
								label={$_('layout.filter.operator')}
								defaultValue={condition.operator}
								options={zFilterOperatorEnum.options.map((operator) => {
									return {
										label: operator,
										value: operator
									};
								})}
								onChange={(value) => {
									condition.operator = value as z.infer<typeof zFilterOperatorEnum>;
									filterContentListStore.set(contentFilters);
									filterContentUrlAutoUpdateStore.set(false);
								}}
							/>

							{#each condition.values as conditionValue, index (index)}
								<nav>
									{#if schema[filter.type][condition.field] === 'boolean'}
										<ComboBox
											label="Value"
											defaultValue={conditionValue as string}
											options={[
												{ label: 'True', value: 'true' },
												{ label: 'False', value: 'false' }
											]}
											onChange={(value) => {
												condition.values[index] = value;
												filterContentListStore.set(contentFilters);
												filterContentUrlAutoUpdateStore.set(false);
											}}
										/>
									{:else if Array.isArray(schema[filter.type][condition.field])}
										<ComboBox
											label="Value"
											defaultValue={conditionValue as string}
											options={(schema[filter.type][condition.field] as string[]).map((value) => {
												return {
													label: camelCaseToHuman(value),
													value
												};
											})}
											onChange={(value) => {
												condition.values[index] = value;
												filterContentListStore.set(contentFilters);
												filterContentUrlAutoUpdateStore.set(false);
											}}
										/>
									{:else}
										<div class="field label surface-container-highest max">
											<input
												oninput={(event: Event & { currentTarget: HTMLInputElement }) => {
													condition.values[index] =
														schema[filter.type][condition.field] === 'number'
															? Number(event.currentTarget.value)
															: event.currentTarget.value;
													filterContentListStore.set(contentFilters);
													filterContentUrlAutoUpdateStore.set(false);
												}}
												name="value"
												type={schema[filter.type][condition.field] === 'string' ? 'text' : 'number'}
												value={conditionValue}
											/>
											<label for="value">{$_('layout.filter.value')}</label>
										</div>
									{/if}
									<button
										onclick={() => {
											condition.values = condition.values.filter((item) => conditionValue !== item);
											filterContentListStore.set(contentFilters);
											filterContentUrlAutoUpdateStore.set(false);
										}}
										class="circle surface-container-highest"
									>
										<i>close</i>
										<div class="tooltip">Delete Value</div>
									</button>
								</nav>

								{#if condition.values.length > 0 && index < condition.values.length - 1}
									<h6 class="center-align">OR</h6>
								{/if}
							{/each}

							<div class="space"></div>
							<button
								onclick={() => {
									condition.values.push('');
									filterContentListStore.set(contentFilters);
									filterContentUrlAutoUpdateStore.set(false);
								}}
								class="surface-container-highest"
							>
								<i>add</i>
								<span>Add OR</span>
							</button>
						</li>

						{#if filter.conditions.length > 0 && conditionIndex < filter.conditions.length - 1}
							<h6 class="center-align">AND</h6>
						{/if}
					{/each}
				</ul>
			{/if}
			<div class="small-space"></div>
			<button
				onclick={() => {
					filter.conditions.push({
						operator: 'equals',
						field: 'author',
						values: ['']
					});
					filterContentListStore.set(contentFilters);
					filterContentUrlAutoUpdateStore.set(false);
				}}
				class="surface-container-highest"
			>
				<i>add</i>
				<span>{$_('layout.filter.addConditional')}</span>
			</button>
		</article>
		<div class="small-space"></div>
	{/each}
{/if}

<div>
	<button class="surface-container-highest">
		<i>add</i>
		<span>{$_('layout.filter.addFilter')}</span>
	</button>
	<menu>
		{#each filterTypes as filterType (filterType)}
			<li role="presentation" onclick={() => addFilter(filterType)}>{titleCase(filterType)}</li>
		{/each}
	</menu>
</div>
