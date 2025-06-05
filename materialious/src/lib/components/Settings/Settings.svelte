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

	let activeTab:
		| 'interface'
		| 'player'
		| 'data'
		| 'ryd'
		| 'api extended'
		| 'sponsorblock'
		| 'dearrow' = $state('interface');

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

<dialog id="dialog-settings" class={dialogType}>
	<nav style="margin-bottom: 1em;">
		<h4 class="max">{$_('layout.settings')}</h4>
		<button class="circle transparent" data-ui="#dialog-settings"><i>close</i></button>
	</nav>

	<div>
		<nav class="tabbed small">
			<a class:active={activeTab === 'interface'} onclick={() => (activeTab = 'interface')}>
				<i>grid_view</i>
				<span>{$_('layout.interface')}</span>
			</a>
			<a class:active={activeTab === 'player'} onclick={() => (activeTab = 'player')}>
				<i>smart_display</i>
				<span>{$_('layout.player.title')}</span>
			</a>
			<a class:active={activeTab === 'ryd'} onclick={() => (activeTab = 'ryd')}>
				<i>thumb_down</i>
				<span>RYD</span>
			</a>
			<a class:active={activeTab === 'api extended'} onclick={() => (activeTab = 'api extended')}>
				<i>sync</i>
				<span>API Extended</span>
			</a>
			<a class:active={activeTab === 'sponsorblock'} onclick={() => (activeTab = 'sponsorblock')}>
				<i>block</i>
				<span>Sponsorblock</span>
			</a>
			<a class:active={activeTab === 'dearrow'} onclick={() => (activeTab = 'dearrow')}>
				<i>keyboard_double_arrow_down</i>
				<span>{$_('layout.deArrow.title')}</span>
			</a>
			<a class:active={activeTab === 'data'} onclick={() => (activeTab = 'data')}>
				<i>save</i>
				<span>{$_('layout.dataPreferences.dataPreferences')}</span>
			</a>
			<a href="https://github.com/sponsors/WardPearce" target="_blank" referrerpolicy="no-referrer">
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
		</nav>
		<div class="page padding" class:active={activeTab === 'interface'}>
			<Interface />
		</div>
		<div class="page padding" class:active={activeTab === 'player'}>
			<Player />
		</div>
		<div class="page padding" class:active={activeTab === 'data'}>
			<DataPreferences />
		</div>
		<div class="page padding" class:active={activeTab === 'ryd'}>
			<Ryd />
		</div>
		<div class="page padding" class:active={activeTab === 'api extended'}>
			<ApiExtended />
		</div>
		<div class="page padding" class:active={activeTab === 'sponsorblock'}>
			<SponsorBlock />
		</div>
		<div class="page padding" class:active={activeTab === 'dearrow'}>
			<DeArrow />
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
