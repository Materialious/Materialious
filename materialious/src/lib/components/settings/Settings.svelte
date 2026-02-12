<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { _ } from '$lib/i18n';
	import ApiExtended from './ApiExtended.svelte';
	import DeArrow from './DeArrow.svelte';
	import Interface from './Interface.svelte';
	import Player from './Player.svelte';
	import Ryd from './RYD.svelte';
	import SponsorBlock from './SponsorBlock.svelte';
	import { isAndroidTvStore } from '$lib/store';
	import About from './About.svelte';
	import Engine from './Engine.svelte';
	import { Capacitor } from '@capacitor/core';

	let activeTab = $state('interface');
	const isActive = (id: string) => activeTab === id;

	const tabs: { id: string; label: string; icon: string; component: Component }[] = [
		{ id: 'interface', label: $_('layout.interface'), icon: 'grid_view', component: Interface },
		{ id: 'player', label: $_('layout.player.title'), icon: 'smart_display', component: Player },
		{ id: 'ryd', label: 'RYD', icon: 'thumb_down', component: Ryd },
		{ id: 'api extended', label: 'API Extended', icon: 'sync', component: ApiExtended },
		{ id: 'sponsorblock', label: 'Sponsorblock', icon: 'block', component: SponsorBlock },
		{
			id: 'dearrow',
			label: $_('layout.deArrow.title'),
			icon: 'keyboard_double_arrow_down',
			component: DeArrow
		},
		{
			id: 'about',
			label: $_('layout.about'),
			icon: 'info',
			component: About
		}
	];

	if (Capacitor.isNativePlatform()) {
		tabs.splice(1, 0, {
			id: 'engine',
			label: $_('layout.engine'),
			icon: 'build',
			component: Engine
		});
	}

	const tabIds = tabs.map((tab) => tab.id);

	let dialogType = $state('');

	function checkWidth() {
		if (innerWidth <= 1320) {
			dialogType = 'right';
		} else {
			dialogType = '';
		}
	}

	function onKeydown(event: KeyboardEvent, idx: number) {
		const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'] as const;
		if (!keys.includes(event.key as (typeof keys)[number])) return;

		event.preventDefault();

		let next = idx;
		switch (event.key) {
			case 'ArrowRight':
				next = (idx + 1) % tabs.length;
				break;
			case 'ArrowLeft':
				next = (idx - 1 + tabs.length) % tabs.length;
				break;
			case 'Home':
				next = 0;
				break;
			case 'End':
				next = tabs.length - 1;
				break;
		}

		activeTab = tabs[next].id;

		const els = document.querySelectorAll<HTMLElement>('[role="tab"]');
		els[next]?.focus();
	}

	onMount(() => {
		checkWidth();

		addEventListener('resize', () => checkWidth());
		if ($isAndroidTvStore) {
			document.getElementById(`tab-${activeTab}`)?.focus();
		}
	});
</script>

<dialog id="dialog-settings" class={dialogType + ' surface-container'}>
	<nav class="s m" style="margin-bottom: 1em;">
		<h4 class="max">{$_('layout.settings')}</h4>
		<button class="circle transparent" data-ui="#dialog-settings"><i>close</i></button>
	</nav>

	<div style="height: 100%;">
		<nav class="wrap s">
			<button class="large small-round surface-container-highest max" data-ui="#tab-menu">
				<i>{tabs[tabIds.indexOf(activeTab)].icon}</i>
				<span>{tabs[tabIds.indexOf(activeTab)].label}</span>
				<menu style="width: 100%;" data-ui="#tab-menu" id="tab-menu">
					{#each tabs as tab (tab)}
						<li
							onclick={() => {
								activeTab = tab.id;
							}}
							role="presentation"
							data-ui="#tab-menu"
						>
							<i>{tab.icon}</i>
							<span>{tab.label}</span>
						</li>
					{/each}
				</menu>
			</button>
		</nav>

		<div class="s">
			<div class="space"></div>
			<div class="divider"></div>
		</div>

		<div class="grid">
			<div class="s12 m4 l4 m l">
				<div class="padding">
					{#each tabs as tab, index (tab)}
						<a
							class:active={isActive(tab.id)}
							aria-selected={isActive(tab.id)}
							class="button surface-container-highest"
							id={`tab-${tab.id}`}
							aria-controls={`panel-${tab.id}`}
							tabindex={isActive(tab.id) ? 0 : -1}
							onclick={() => (activeTab = tab.id)}
							onkeydown={(event) => onKeydown(event, index)}
						>
							<i>{tab.icon}</i>
							<span>{tab.label}</span>
						</a>
						<div class="space"></div>
					{/each}
				</div>
			</div>
			<div class="s12 m8 l8">
				{#each tabs as tab (tab)}
					<div
						class="page padding"
						id={`panel-${tab.id}`}
						aria-labelledby={`tab-${tab.id}`}
						hidden={!isActive(tab.id)}
						inert={!$isAndroidTvStore && !isActive(tab.id)}
						aria-hidden={!isActive(tab.id)}
						class:active={isActive(tab.id)}
					>
						<tab.component />
					</div>
				{/each}
			</div>
		</div>
	</div>
</dialog>

<style>
	#dialog-settings {
		width: 800px;
		height: 800px;
	}

	.page {
		max-height: 800px;
		overflow: scroll;
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

	a.button {
		width: 100%;
		box-sizing: border-box !important;
	}

	@media screen and (max-width: 800px) {
		#dialog-settings {
			width: 100%;
			height: 100%;
		}

		.page {
			max-height: 100%;
		}
	}
</style>
