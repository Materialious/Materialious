<script lang="ts">
	import {
		getDynamicTheme,
		setAmoledTheme,
		setThemeColor,
		type ThemeColors,
		type ThemeKey
	} from '$lib/theme';
	import ui from 'beercss';
	import type { RgbaColor, HsvaColor, Colord } from 'colord';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import ColorPicker from 'svelte-awesome-color-picker';
	import {
		darkModeStore,
		interfaceAdvancedThemingStore,
		interfaceAmoledTheme,
		interfaceBorderRadiusStore,
		themeColorStore
	} from '../../store';
	import { onMount, tick } from 'svelte';
	import { titleCase } from '$lib/letterCasing';

	let colorPickerOpen = $state(false);
	let colorPickerDebounce: ReturnType<typeof setTimeout>;

	let currentThemeColors: ThemeColors | undefined = $state();

	onMount(async () => {
		currentThemeColors = await getDynamicTheme();
	});

	async function setThemeColors() {
		await tick();

		currentThemeColors = await getDynamicTheme();
		interfaceAdvancedThemingStore.set(currentThemeColors);
	}

	async function colorOnInput(
		color: {
			hsv: HsvaColor | null;
			rgb: RgbaColor | null;
			hex: string | null;
			color: Colord | null;
		},
		propetyKey: ThemeKey
	) {
		if (colorPickerDebounce) clearTimeout(colorPickerDebounce);

		colorPickerDebounce = setTimeout(async () => {
			if (!color.hex) return;
			setThemeColor(propetyKey, color.hex);
			await setThemeColors();
		}, 100);
	}

	async function themeColorOnInput(color: {
		hsv: HsvaColor | null;
		rgb: RgbaColor | null;
		hex: string | null;
		color: Colord | null;
	}) {
		if (!color.hex) return;
		if (colorPickerDebounce) clearTimeout(colorPickerDebounce);

		colorPickerDebounce = setTimeout(async () => {
			interfaceAdvancedThemingStore.set({});

			themeColorStore.set(color.hex);
			await tick();

			setAmoledTheme();
			currentThemeColors = await getDynamicTheme();
		}, 100);
	}

	async function toggleDarkMode() {
		const isDark = get(darkModeStore);

		interfaceAdvancedThemingStore.set({});

		if (isDark) {
			ui('mode', 'light');
			darkModeStore.set(false);
		} else {
			ui('mode', 'dark');
			darkModeStore.set(true);
		}

		currentThemeColors = await getDynamicTheme();
	}
</script>

<button onclick={toggleDarkMode} class="no-margin surface-container-highest">
	{#if !$darkModeStore}
		<i>dark_mode</i>
		<span>{$_('layout.theme.darkMode')}</span>
	{:else}
		<i>light_mode</i>
		<span>{$_('layout.theme.lightMode')}</span>
	{/if}
</button>
<button class="surface-container-highest" onclick={() => (colorPickerOpen = !colorPickerOpen)}>
	<i>palette</i>
	<span>{$_('layout.theme.color')}</span>
</button>

{#if colorPickerOpen}
	<div class="space"></div>

	<div class="color-picker global-color-picker">
		<ColorPicker
			isTextInput={false}
			isDialog={false}
			onInput={themeColorOnInput}
			position="responsive"
			isAlpha={false}
			hex={get(themeColorStore)}
			sliderDirection="horizontal"
		/>
	</div>
{/if}

<div class="space"></div>

{#if $darkModeStore}
	<div class="field no-margin">
		<nav class="no-padding">
			<div class="max">
				<div>{$_('layout.theme.AmoledTheme')}</div>
			</div>
			<label class="switch" tabindex="0">
				<input
					type="checkbox"
					bind:checked={$interfaceAmoledTheme}
					onclick={async () => {
						interfaceAdvancedThemingStore.set({});
						interfaceAmoledTheme.set(!$interfaceAmoledTheme);
						await setThemeColors();
					}}
					role="switch"
				/>
				<span></span>
			</label>
		</nav>
	</div>
{/if}

<h5>{$_('layout.theme.borderRadius.borderRadius')}</h5>
<div class="grid">
	<div class="s6 m3 l3">
		<button
			onclick={() => {
				interfaceBorderRadiusStore.set(0);
			}}
			class="surface-container-highest"
			style="border-radius: 0 !important;width: 80%;"
		>
			<p>{$_('layout.theme.borderRadius.none')}</p>
		</button>
	</div>
	<div class="s6 m3 l3">
		<button
			onclick={() => {
				interfaceBorderRadiusStore.set(0.25);
			}}
			class="surface-container-highest"
			style="border-radius: 0.25rem !important;width: 80%;"
		>
			<p>{$_('layout.theme.borderRadius.slight')}</p>
		</button>
	</div>
	<div class="s6 m3 l3">
		<button
			onclick={() => {
				interfaceBorderRadiusStore.set(0.5);
			}}
			class="surface-container-highest"
			style="border-radius: 0.5rem !important;width: 80%;"
		>
			<p>{$_('layout.theme.borderRadius.modern')}</p>
		</button>
	</div>
	<div class="s6 m3 l3">
		<button
			onclick={() => {
				interfaceBorderRadiusStore.set(1);
			}}
			class="surface-container-highest"
			style="border-radius: 1rem !important;width: 80%;"
		>
			<p>{$_('layout.theme.borderRadius.rounded')}</p>
		</button>
	</div>
</div>

<h5>{$_('layout.theme.advanced')}</h5>
<div class="space"></div>

{#if currentThemeColors}
	{#each Object.entries(currentThemeColors) as [themeVar, themeColor] (themeVar)}
		<div class="color-picker">
			<ColorPicker
				hex={themeColor}
				label={titleCase(themeVar.replaceAll('--', '').replaceAll('-', ' '))}
				position="responsive"
				textInputModes={['hex']}
				sliderDirection="vertical"
				onInput={async (color) => await colorOnInput(color, themeVar as ThemeKey)}
			/>
		</div>
	{/each}
{/if}

<style>
	.color-picker {
		--cp-bg-color: var(--surface-container);
		--cp-border-color: transparent;
		--cp-text-color: var(--on-surface);
		--cp-input-color: var(--surface);
		--cp-button-hover-color: var(--surface-variant);
		--slider-width: 30px;
		--picker-width: 350px;
		width: 100%;
		--input-size: 40px;
	}

	.global-color-picker {
		--slider-width: 50px;
		--picker-width: 500px;
	}

	@media screen and (max-width: 640px) {
		.global-color-picker {
			--picker-width: 95vw;
		}
	}
</style>
