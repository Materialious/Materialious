<script lang="ts">
	import { _ } from '$lib/i18n';
	import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
	import { dictionary as commonDictionary, adjacencyGraphs } from '@zxcvbn-ts/language-common';
	import { dictionary as enDictionary, translations } from '@zxcvbn-ts/language-en';

	zxcvbnOptions.setOptions({
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
			const result = zxcvbn(password);
			score = result.score;
		} else {
			score = null;
		}
	});
</script>

{#if show && score !== null}
	<div class="password-strength">
		<div class="strength-bar">
			<div class={`score-${score} strength-fill`}></div>
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
		height: 4px;
		background: var(--secondary);
		border-radius: 2px;
		overflow: hidden;
	}

	.strength-fill {
		height: 100%;
		transition:
			width 0.2s ease,
			background-color 0.2s ease;
	}

	.strength-fill.score-0 {
		width: 20%;
		background: #f44336;
	}
	.strength-fill.score-1 {
		width: 40%;
		background: #ff9800;
	}
	.strength-fill.score-2 {
		width: 60%;
		background: #ffeb3b;
	}
	.strength-fill.score-3 {
		width: 80%;
		background: #8bc34a;
	}
	.strength-fill.score-4 {
		width: 100%;
		background: #4caf50;
	}

	.strength-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 500;
		margin-top: 0.25rem;
	}
</style>
