<script lang="ts">
	import { _ } from '$lib/i18n';
	import { exportSubscriptionsAsFile, importSubscriptionsFromFile } from '$lib/importExport';
	import { addToast, toaster } from '../Toast.svelte';
	import { getSubscriptions } from '$lib/api';
	import { importSubscriptions } from '$lib/importExport';
	import { postSubscribeInvidious } from '$lib/api/invidious/subscribe';
	import { getSubscriptionsInvidious } from '$lib/api/invidious/feed';
	import { backendInUseStore, invidiousAuthStore, invidiousInstanceStore } from '$lib/store';
	import { Clipboard } from '@capacitor/clipboard';
	import { loadSettingsFromFile, settingsToJson } from '$lib/externalSettings';
	import { downloadStringAsFile } from '$lib/misc';

	async function importInvidiousSubs() {
		const importedSubs = await getSubscriptionsInvidious();

		addToast({
			data: {
				text: $_('layout.backendEngine.importingToMaterialious')
			},
			id: 'import-to-materialious',
			closeDelay: 0
		});

		await importSubscriptions(importedSubs);

		toaster.removeToast('import-to-materialious');

		addToast({
			data: {
				text: $_('layout.backendEngine.importingToMaterialiousFinished')
			}
		});
	}

	async function exportMaterialiousSubs() {
		const subs = await getSubscriptions();

		addToast({
			data: {
				text: $_('layout.backendEngine.exportingToInvidious')
			},
			id: 'export-to-invidious',
			closeDelay: 0
		});

		const subPromises: Promise<void>[] = [];
		for (const sub of subs) {
			subPromises.push(postSubscribeInvidious(sub.authorId));
		}

		await Promise.all(subPromises);

		toaster.removeToast('export-to-invidious');

		addToast({
			data: {
				text: $_('layout.backendEngine.exportingToInvidiousFinished')
			}
		});
	}
</script>

<h3>{$_('pages.subscriptions')}</h3>
<div class="space"></div>

<div>
	<button class="surface-container-highest">
		<i>attach_file</i>
		<span>{$_('layout.export.importSub')}</span>
	</button>
	<input
		onchange={async (event: Event) => {
			const files = (event.target as HTMLInputElement).files;
			if (files?.length === 0 || !files) return;

			addToast({
				data: {
					text: $_('layout.export.importing')
				},
				id: 'importing-toast',
				closeDelay: 0
			});

			await importSubscriptionsFromFile(files[0]);

			toaster.removeToast('importing-toast');

			addToast({
				data: {
					text: $_('layout.export.importingCompleted')
				}
			});
		}}
		type="file"
	/>
</div>
<p><i>info</i> {$_('layout.export.importSubSupported')}</p>

<div class="space"></div>

<div>
	<button class="surface-container-highest">
		<i>file_export</i>
		<span>{$_('layout.export.exportSub')}</span>
	</button>
	<menu>
		<li role="presentation" onclick={() => exportSubscriptionsAsFile('InvidiousJSON')}>
			Invidious JSON
		</li>
		<li role="presentation" onclick={() => exportSubscriptionsAsFile('OPML')}>
			FreeTube/NewPipe/YouTube OPML
		</li>
	</menu>
</div>

{#if $invidiousAuthStore && $invidiousInstanceStore && $backendInUseStore === 'yt'}
	<div class="space"></div>
	<h6>{$_('layout.backendEngine.importExport')}</h6>
	<div class="space"></div>

	<button onclick={exportMaterialiousSubs} class="surface-container-highest">
		<i>upload</i>
		<div>{$_('layout.backendEngine.exportToInvidious')}</div>
	</button>

	<div class="space"></div>

	<button onclick={importInvidiousSubs} class="surface-container-highest">
		<i>download</i>
		<div>{$_('layout.backendEngine.importToMaterialious')}</div>
	</button>
{/if}

<h3>{$_('layout.settings')}</h3>
<div class="space"></div>
<button
	class="no-margin surface-container-highest"
	onclick={async () => {
		await Clipboard.write({ string: settingsToJson() });

		addToast({
			data: {
				text: $_('player.share.copiedSuccess')
			}
		});
	}}
>
	<i>content_copy</i>
	<span>{$_('layout.export.exportToClipboard')}</span>
</button>
<div class="space"></div>
<button
	class="no-margin surface-container-highest"
	onclick={async () => {
		downloadStringAsFile(settingsToJson(), 'materialious-settings.json');
	}}
>
	<i>file_export</i>
	<span>{$_('layout.export.exportToFile')}</span>
</button>

<div class="space"></div>

<div>
	<button class="surface-container-highest">
		<i>attach_file</i>
		<span>{$_('layout.export.importFromFile')}</span>
	</button>
	<input
		onchange={async (event: Event) => {
			const files = (event.target as HTMLInputElement).files;
			if (files?.length === 0 || !files) return;

			await loadSettingsFromFile(files[0]);
		}}
		type="file"
	/>
</div>
