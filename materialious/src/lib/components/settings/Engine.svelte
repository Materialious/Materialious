<script lang="ts">
	import { isYTBackend } from '$lib/misc';
	import { _ } from '$lib/i18n';
	import { engineCullYTStore } from '$lib/store';
</script>

{#if isYTBackend()}
	<div class="field label prefix border">
		<i>view_stream</i>
		<input
			oninput={(event: Event) => {
				engineCullYTStore.set(Number((event.target as HTMLInputElement).value));
			}}
			value={$engineCullYTStore}
			name="cull"
			type="number"
		/>
		<label for="cull">{$_('layout.backendEngine.cull')}</label>
	</div>
{/if}
