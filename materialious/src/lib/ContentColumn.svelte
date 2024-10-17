<script lang="ts">
	import { onMount } from 'svelte';

	let largeCol = '2';

	function checkWidth() {
		if (innerWidth <= 1750) {
			largeCol = '4';
		} else {
			largeCol = '2';
		}
	}

	onMount(() => {
		checkWidth();

		addEventListener('resize', () => checkWidth());
	});
</script>

<div class="s12 m6 l{largeCol}">
	<slot />
</div>
