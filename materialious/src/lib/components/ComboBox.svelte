<script lang="ts">
	import { _ } from '$lib/i18n';
	import { mergeAttrs } from 'melt';
	import { Combobox } from 'melt/builders';

	type ComboOption = { label: string; value: string };

	let {
		options,
		label,
		defaultValue = undefined,
		onChange = undefined
	}: {
		options: ComboOption[];
		label: string;
		defaultValue?: string;
		onChange?: (value: string) => void;
	} = $props();

	let initialValueChange = true;
	const combobox = new Combobox<string>({
		onValueChange: (value) => {
			if (initialValueChange && typeof defaultValue !== 'undefined') {
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
</script>

<div class="field label suffix surface-container-highest">
	<input
		{...mergeAttrs(combobox.input, {
			value: valueToLabel[combobox.input.value]
		})}
	/>
	<label {...combobox.label}>{label}</label>
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
