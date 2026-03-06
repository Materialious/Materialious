<script lang="ts">
	import { _ } from '$lib/i18n';
	import { importSubscriptionsFromFile } from '$lib/importExport';
	import { addToast, toaster } from '../Toast.svelte';
</script>

<div>
	<button>
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
