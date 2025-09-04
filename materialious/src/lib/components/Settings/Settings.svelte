<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import ApiExtended from './ApiExtended.svelte';
	import DataPreferences from './DataPreferences.svelte';
	import DeArrow from './DeArrow.svelte';
	import Interface from './Interface.svelte';
	import Player from './Player.svelte';
	import Ryd from './RYD.svelte';
	import SponsorBlock from './SponsorBlock.svelte';
	import { isAndroidTvStore } from '$lib/store';

	let activeTab = $state('interface');
	const isActive = (id: string) => activeTab === id;

	const tabs = [
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
		}
	];

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

<dialog id="dialog-settings" class={dialogType}>
	<nav style="margin-bottom: 1em;">
		<h4 class="max">{$_('layout.settings')}</h4>
		<button class="circle transparent" data-ui="#dialog-settings"><i>close</i></button>
	</nav>

	<div>
		<nav class="tabbed small" style="outline: none" role="tablist" tabindex="0">
			{#each tabs as tab, i}
				<a
					role="tab"
					class:active={isActive(tab.id)}
					aria-selected={isActive(tab.id)}
					id={`tab-${tab.id}`}
					aria-controls={`panel-${tab.id}`}
					tabindex={isActive(tab.id) ? 0 : -1}
					onclick={() => (activeTab = tab.id)}
					onkeydown={(event) => onKeydown(event, i)}
				>
					<i>{tab.icon}</i>
					<span>{tab.label}</span>
				</a>
			{/each}
			{#if !$isAndroidTvStore}
				<a
					role="tab"
					class:active={isActive('data')}
					aria-selected={isActive('data')}
					id="tab-data"
					aria-controls="panel-data"
					tabindex="0"
					onclick={() => (activeTab = 'data')}
				>
					<i>save</i>
					<span>{$_('layout.dataPreferences.dataPreferences')}</span>
				</a>
				<a
					href="https://github.com/sponsors/WardPearce"
					target="_blank"
					referrerpolicy="no-referrer"
				>
					<i>favorite</i>
					<span>{$_('donate')}</span>
				</a>
				<a
					href="https://github.com/Materialious/Materialious"
					target="_blank"
					referrerpolicy="no-referrer"
				>
					<i>code</i>
					<span>GitHub</span>
				</a>
			{/if}
		</nav>
		{#each tabs as tab, _}
			<div
				class="page padding"
				id={`panel-${tab.id}`}
				role="tabpanel"
				aria-labelledby={`tab-${tab.id}`}
				hidden={!isActive(tab.id)}
				inert={!$isAndroidTvStore && !isActive(tab.id)}
				aria-hidden={!isActive(tab.id)}
				class:active={isActive(tab.id)}
			>
				<tab.component />
			</div>
		{/each}
		<div
			class="page padding"
			id="panel-data"
			role="tabpanel"
			aria-labelledby="tab-data"
			hidden={!isActive('data')}
			inert={!$isAndroidTvStore && !isActive('data')}
			aria-hidden={!isActive('data')}
			class:active={isActive('data')}
		>
			<DataPreferences />
		</div>
	</div>
</dialog>

<style>
	dialog {
		width: 1320px;
	}

	.tabbed > a {
		flex: none;
	}

	@media screen and (max-width: 1320px) {
		.tabbed {
			display: flex !important;
			gap: 0 !important;
			flex: 0 !important;
			align-items: start !important;
			padding: 1em 0 !important;
			overflow-x: scroll !important;
			background-color: transparent;
			border-bottom: solid 1px var(--outline-variant);
		}

		.tabbed > a {
			font-size: 1.5rem !important;
			padding: 0.5em 0.3em !important;
			border-radius: 3em !important;
		}

		.tabbed.small {
			block-size: 100% !important;
			border-radius: 0 !important;
		}
	}
</style>
