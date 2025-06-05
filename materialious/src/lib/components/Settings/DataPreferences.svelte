<script lang="ts">
	import { instanceStore } from '$lib/store';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
</script>

<p style="width: 240px;">
	<a
		href={`${get(instanceStore)}/preferences`}
		target="_blank"
		rel="noopener noreferrer"
		class="link"
	>
		{$_('layout.dataPreferences.content')}
	</a>
</p>
