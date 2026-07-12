<script lang="ts">
	import { _ } from '$lib/i18n';
	import { ZxcvbnFactory } from '@zxcvbn-ts/core';
	import { dictionary as commonDictionary, adjacencyGraphs } from '@zxcvbn-ts/language-common';
	import { dictionary as enDictionary, translations } from '@zxcvbn-ts/language-en';

	const zxcvbn = new ZxcvbnFactory({
		dictionary: {
			...commonDictionary,
			...enDictionary
		},
		graphs: adjacencyGraphs,
		translations
	});

	let { password, show = true }: { password: string; show?: boolean } = $props();

	let score = $state<number | null>(null);

	let strengthLabelKey = $derived(
		score === null
			? ''
			: score === 0
				? 'veryWeak'
				: score === 1
					? 'weak'
					: score === 2
						? 'fair'
						: score === 3
							? 'strong'
							: 'veryStrong'
	);

	$effect(() => {
		if (password) {
			const result = zxcvbn.check(password);
			score = result.score;
		} else {
			score = null;
		}
	});
</script>

{#if show && score !== null}
	<div class="password-strength">
		<div class="strength-bar">
			{#each [0, 1, 2, 3, 4] as i (i)}
				<div class="strength-segment" class:filled={score !== null && i <= score}></div>
			{/each}
		</div>
		<span class="strength-label">{$_(strengthLabelKey)}</span>
	</div>
{/if}

<style>
	.password-strength {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
		padding: 0 0.5rem;
	}

	.strength-bar {
		display: flex;
		gap: 4px;
	}

	.strength-segment {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: var(--secondary);
		transition: background-color 0.2s ease;
	}

	.strength-segment.filled {
		background: var(--primary);
	}

	.strength-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 500;
		margin-top: 0.25rem;
	}
</style>
