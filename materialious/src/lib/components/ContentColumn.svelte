<script lang="ts">
	import androidTv from '$lib/android/plugins/androidTv';
	import { onMount } from 'svelte';

	let { children } = $props();

	let largeCol = $state('2');
	let smallCol = $state('12');
	let mediumCol = $state('6');

	async function checkWidth() {
		if (await androidTv.isAndroidTv()) {
			mediumCol = '3';
		} else if (innerWidth <= 1750) {
			largeCol = '4';
		} else {
			largeCol = '2';
		}
	}

	onMount(async () => {
		await checkWidth();

		addEventListener('resize', () => checkWidth());
	});
</script>

<div class="s{smallCol} m{mediumCol} l{largeCol}">
	{@render children?.()}
</div>
