<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { _ } from '$lib/i18n';
	import DeArrow from './DeArrow.svelte';
	import Interface from './Interface.svelte';
	import Player from './Player.svelte';
	import Ryd from './RYD.svelte';
	import SponsorBlock from './SponsorBlock.svelte';
	import { rawMasterKeyStore } from '$lib/store';
	import About from './About.svelte';
	import Engine from './Engine.svelte';
	import { isUnrestrictedPlatform } from '$lib/misc';
	import { isOwnBackend } from '$lib/shared';
	import InternalAccount from './InternalAccount.svelte';
	import { Tabs } from 'melt/builders';
	import { mergeAttrs } from 'melt';
	import Filters from './Filters.svelte';
	import ExportImport from './ExportImport.svelte';

	type TabCategories =
		| 'interface'
		| 'player'
		| 'ryd'
		| 'sponsorblock'
		| 'dearrow'
		| 'about'
		| 'engine'
		| 'account'
		| 'filters'
		| 'export';

	const tabCategories: Tabs<TabCategories> = new Tabs({
		value: 'interface',
		orientation: 'vertical',
		loop: true,
		selectWhenFocused: true
	});

	const isActive = (id: string) => tabCategories.value === id;

	let mobileCategoriesButton: HTMLElement | undefined = $state();

	let tabs: { id: TabCategories; label: string; icon: string; component: Component }[] = $state([
		{ id: 'interface', label: $_('layout.interface'), icon: 'grid_view', component: Interface },
		{ id: 'player', label: $_('layout.player.title'), icon: 'smart_display', component: Player },
		{ id: 'filters', label: $_('layout.filter.title'), icon: 'filter_alt', component: Filters },
		{ id: 'ryd', label: 'Return YT Dislike', icon: 'thumb_down', component: Ryd },
		{ id: 'sponsorblock', label: 'Sponsorblock', icon: 'block', component: SponsorBlock },
		{
			id: 'dearrow',
			label: $_('layout.deArrow.title'),
			icon: 'keyboard_double_arrow_down',
			component: DeArrow
		},
		{
			id: 'export',
			label: $_('layout.export.title'),
			icon: 'file_export',
			component: ExportImport
		},
		{
			id: 'about',
			label: $_('layout.about'),
			icon: 'info',
			component: About
		}
	]);

	if (isUnrestrictedPlatform()) {
		tabs.splice(1, 0, {
			id: 'engine',
			label: $_('layout.engine'),
			icon: 'rocket_launch',
			component: Engine
		});
	}

	rawMasterKeyStore.subscribe((value) => {
		if (isOwnBackend()?.internalAuth && value) {
			tabs.splice(1, 0, {
				id: 'account',
				label: $_('layout.materialiousAccount'),
				icon: 'person',
				component: InternalAccount
			});
		} else {
			tabs = tabs.filter((tab) => {
				return tab.id !== 'account';
			});
		}
	});

	let dialogType = $state('');
	function checkWidth() {
		if (innerWidth <= 1320) {
			dialogType = 'right';
		} else {
			dialogType = '';
		}
	}

	onMount(() => {
		checkWidth();
		addEventListener('resize', () => checkWidth());
	});
</script>

<dialog id="dialog-settings" class={dialogType + ' surface-container'}>
	<nav class="s m" style="margin-bottom: 1em;">
		<h4 class="max">{$_('layout.settings')}</h4>
		<button class="circle transparent" data-ui="#dialog-settings"><i>close</i></button>
	</nav>

	<div style="height: 100%;">
		<nav class="wrap s">
			{#if tabs}
				{@const currentTab = tabs.find((tab) => tab.id === tabCategories.value)}

				{#if currentTab}
					<button
						bind:this={mobileCategoriesButton}
						class="large surface-container-highest max"
						data-ui="#tab-menu"
					>
						<i>{currentTab.icon}</i>
						<span>{currentTab.label}</span>
						<menu
							style="width: 100%;"
							data-ui="#tab-menu"
							id="tab-menu"
							{...tabCategories.triggerList}
						>
							{#each tabs as tab (tab)}
								<li
									{...mergeAttrs(tabCategories.getTrigger(tab.id), {
										onclick: () => {
											mobileCategoriesButton?.click();
										}
									})}
								>
									<i>{tab.icon}</i>
									<span>{tab.label}</span>
								</li>
							{/each}
						</menu>
					</button>
				{/if}
			{/if}
		</nav>

		<div class="s">
			<div class="space"></div>
			<div class="divider"></div>
		</div>

		<div class="grid">
			<div class="s12 m4 l4 m l">
				<div class="categories padding" {...tabCategories.triggerList}>
					{#each tabs as tab (tab)}
						<button
							class:active={isActive(tab.id)}
							class:surface-container-lowest={isActive(tab.id)}
							class:surface-container-highest={!isActive(tab.id)}
							{...tabCategories.getTrigger(tab.id)}
						>
							<i>{tab.icon}</i>
							<span>{tab.label}</span>
						</button>
						<div class="space"></div>
					{/each}
				</div>
			</div>
			<div class="s12 m8 l8">
				<div class="settings padding">
					{#each tabs as tab (tab)}
						<div {...tabCategories.getContent(tab.id)}>
							<tab.component />
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</dialog>

<style>
	#dialog-settings {
		width: 800px;
	}

	.categories {
		position: sticky;
		top: 0;
		height: 100%;
		overflow: hidden;
		height: fit-content;
	}

	.settings {
		height: 800px;
		overflow-y: auto;
		padding-right: 10px;
	}

	.grid {
		margin-top: 0 !important;
		height: 100% !important;
	}

	.grid .m,
	.grid .l {
		border-right: solid 1px var(--secondary);
		border-radius: 0;
	}

	dialog {
		padding: 0;
	}

	.categories button {
		width: 100%;
		box-sizing: border-box !important;
	}

	@media screen and (max-width: 800px) {
		#dialog-settings {
			width: 100%;
			height: 100%;
		}

		.settings {
			height: 100%;
		}

		#tab-menu {
			height: fit-content !important;
			max-height: fit-content !important;
		}
	}
</style>
