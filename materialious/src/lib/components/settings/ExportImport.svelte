<script lang="ts">
	import { _ } from '$lib/i18n';
	import { importSubscriptionsFromFile } from '$lib/importExport';
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

			await importSubscriptionsFromFile(files[0]);
		}}
		type="file"
	/>
</div>
<p><i>info</i> {$_('layout.export.importSubSupported')}</p>
