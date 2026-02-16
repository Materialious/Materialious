<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="space"></div>

<div
	style="display: flex;align-items: center;flex-direction: column;text-align: center;padding: 90px;"
>
	<svg xmlns="http://www.w3.org/2000/svg" height="200" viewBox="0 -960 960 960" width="200"
		><path
			d="M480-420q-68 0-123.5 38.5T276-280h408q-25-63-80.5-101.5T480-420Zm-168-60 44-42 42 42 42-42-42-42 42-44-42-42-42 42-44-42-42 42 42 44-42 42 42 42Zm250 0 42-42 44 42 42-42-42-42 42-44-42-42-44 42-42-42-42 42 42 44-42 42 42 42ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"
		/></svg
	>

	{#if page.error}
		<article style="white-space: pre-line;word-wrap: break-word;">
			<article class="surface-container-highest"><p>{page.error.message}</p></article>
		</article>
	{/if}
</div>
