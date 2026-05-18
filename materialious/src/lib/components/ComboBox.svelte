<script lang="ts">
	import { _ } from '$lib/i18n';
	import { mergeAttrs } from 'melt';
	import { Combobox } from 'melt/builders';
	import { isAndroidTvStore } from '$lib/store';

	type ComboOption = { label: string; value: any };

	let {
		options,
		label = undefined,
		defaultValue = undefined,
		onChange = undefined
	}: {
		options: ComboOption[];
		label?: string;
		defaultValue?: string | null;
		onChange?: (value: string) => void;
	} = $props();

	let initialValueChange = true;
	const combobox = new Combobox<string>({
		onValueChange: (value) => {
			if (initialValueChange && defaultValue) {
				initialValueChange = false;
				return;
			}

			if (value) onChange?.(value);
		}
	});

	if (defaultValue) combobox.select(defaultValue);

	let valueToLabel: Record<string, string> = {};

	setValuesToLabel();

	function setValuesToLabel() {
		for (const option of options) {
			valueToLabel[option.value] = option.label;
		}
	}

	$effect(() => {
		setValuesToLabel();
	});

	const filtered = $derived.by(() => {
		if (!combobox.touched) return options;
		return options.filter((o) =>
			o.label.toLowerCase().includes(combobox.inputValue.trim().toLowerCase())
		);
	});

	function handleNativeSelect(event: Event) {
		const value = (event.target as HTMLSelectElement).value;
		onChange?.(value);
	}
</script>

{#if $isAndroidTvStore}
	<div class="field suffix surface-container-highest" class:label={typeof label === 'string'}>
		<select onchange={handleNativeSelect}>
			{#each options as option (option.value)}
				<option value={option.value} selected={option.value === defaultValue}>
					{option.label}
				</option>
			{/each}
		</select>
		{#if label}
			<label for={combobox.label.for}>{label}</label>
		{/if}
		<i>keyboard_arrow_down</i>
	</div>
{:else}
	<div class="field suffix surface-container-highest" class:label={typeof label === 'string'}>
		<input
			{...mergeAttrs(combobox.input, {
				value: valueToLabel[combobox.input.value]
			})}
		/>
		{#if label}
			<label {...combobox.label}>{label}</label>
		{/if}
		<i>keyboard_arrow_down</i>

		<div {...combobox.content}>
			{#each filtered as option (option)}
				<div {...combobox.getOption(option.value)}>
					{option.label}
					{#if combobox.isSelected(option.value)}
						<i>check</i>
					{/if}
				</div>
			{:else}
				<span>{$_('noResult')}</span>
			{/each}
		</div>
	</div>
{/if}
