<script module lang="ts">
	export type { InfiniteEvent } from 'svelte-infinite-loading';
</script>

<script lang="ts">
	import InfiniteLoadingBase, { type InfiniteLoadingProps } from 'svelte-infinite-loading';

	type Props = Omit<InfiniteLoadingProps, 'spinner'>;

	let {
		distance = 100,
		direction = 'bottom',
		forceUseInfiniteWrapper = false,
		identifier = +new Date()
	}: Props = $props();
</script>

<InfiniteLoadingBase {distance} {direction} {forceUseInfiniteWrapper} {identifier} on:infinite>
	<progress
		slot="spinner"
		class="circle indeterminate"
		value="50"
		max="100"
		style="margin-top: 2rem;"
	></progress>
</InfiniteLoadingBase>
