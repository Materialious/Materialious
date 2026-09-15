import { type Component } from 'svelte';
import { Capacitor } from '@capacitor/core';
import {
	isMaterialiousAccountActive,
	isUnrestrictedPlatform,
	remoteMaterialiousSupported
} from '$lib/backend';
import { isAndroidTv } from '$lib/utils';
import { isAdminUsername } from '$lib/shared';
import { backendFetch } from '$lib/api/backend/request';
import Interface from './Interface.svelte';
import Theme from './Theme.svelte';
import Player from './Player.svelte';
import Filters from './Filters.svelte';
import Ryd from './RYD.svelte';
import SponsorBlock from './SponsorBlock.svelte';
import DeArrow from './DeArrow.svelte';
import About from './About.svelte';
import Engine from './Engine.svelte';
import Binds from './Binds.svelte';
import ExportImport from './ExportImport.svelte';
import InternalAccount from './InternalAccount.svelte';
import Admin from './Admin.svelte';

export type SettingsTabCategories =
	| 'interface'
	| 'player'
	| 'ryd'
	| 'sponsorblock'
	| 'dearrow'
	| 'about'
	| 'engine'
	| 'account'
	| 'admin'
	| 'filters'
	| 'export'
	| 'theme'
	| 'binds';

export type Translator = (key: string, options?: any) => string;

export type SettingsTab = {
	id: SettingsTabCategories;
	label: string | ((translate: Translator) => string);
	icon: string;
	component: Component;
};

export function getTabLabel(tab: SettingsTab, translate: Translator): string {
	return typeof tab.label === 'function' ? tab.label(translate) : tab.label;
}

const translated = (key: string) => (translate: Translator) => translate(key);

export function getSettingsTabs(): SettingsTab[] {
	const tabs: SettingsTab[] = [
		{
			id: 'interface',
			label: translated('layout.interface'),
			icon: 'grid_view',
			component: Interface
		},
		{
			id: 'theme',
			label: translated('layout.theme.theme'),
			icon: 'colors',
			component: Theme
		},
		{
			id: 'player',
			label: translated('layout.player.title'),
			icon: 'smart_display',
			component: Player
		},
		{
			id: 'filters',
			label: translated('layout.filter.title'),
			icon: 'filter_alt',
			component: Filters
		},
		{ id: 'ryd', label: 'Return YT Dislike', icon: 'thumb_down', component: Ryd },
		{ id: 'sponsorblock', label: 'Sponsorblock', icon: 'block', component: SponsorBlock },
		{
			id: 'dearrow',
			label: translated('layout.deArrow.title'),
			icon: 'keyboard_double_arrow_down',
			component: DeArrow
		},
		{
			id: 'about',
			label: translated('layout.about'),
			icon: 'info',
			component: About
		}
	];

	if (isUnrestrictedPlatform()) {
		tabs.splice(tabs.length - 1, 0, {
			id: 'engine',
			label: translated('layout.engine'),
			icon: 'rocket_launch',
			component: Engine
		});
	}

	if (Capacitor.getPlatform() === 'web' || Capacitor.getPlatform() === 'electron') {
		tabs.splice(tabs.length - 1, 0, {
			id: 'binds',
			label: translated('layout.binds.title'),
			icon: 'keyboard',
			component: Binds
		});
	}

	if (!isAndroidTv()) {
		tabs.splice(tabs.length - 1, 0, {
			id: 'export',
			label: translated('layout.export.title'),
			icon: 'file_export',
			component: ExportImport
		});
	}

	return tabs;
}

export function updateAccountTabs(tabs: SettingsTab[]): SettingsTab[] {
	if (isMaterialiousAccountActive() && remoteMaterialiousSupported()) {
		if (!tabs.find((tab) => tab.id === 'account')) {
			tabs.splice(tabs.length - 1, 0, {
				id: 'account',
				label: translated('layout.materialiousAccount'),
				icon: 'person',
				component: InternalAccount
			});
		}

		void backendFetch('/api/user/me')
			.then(async (resp) => {
				if (!resp.ok) return;
				const me = await resp.json();
				if (isAdminUsername(me.username)) {
					if (!tabs.find((tab) => tab.id === 'admin')) {
						tabs.splice(tabs.length - 1, 0, {
							id: 'admin',
							label: translated('layout.admin'),
							icon: 'admin_panel_settings',
							component: Admin
						});
					}
				} else {
					removeTab(tabs, 'admin');
				}
			})
			.catch(() => {
				// Remote instance unreachable.
			});
	} else {
		removeTab(tabs, 'account');
		removeTab(tabs, 'admin');
	}

	return tabs;
}

function removeTab(tabs: SettingsTab[], id: SettingsTabCategories) {
	const index = tabs.findIndex((tab) => tab.id === id);
	if (index !== -1) tabs.splice(index, 1);
}
