<script lang="ts">
	type Answer = {
		text: string;
		action: () => void;
	};

	let {
		answers,
		question,
		info = undefined
	}: {
		answers: Answer[];
		question: string;
		info?: string;
	} = $props();

	const coloumSize = answers.length > 2 ? '4' : '6';

	let selectedAnswer = $state('');
	function selectAnswer(answer: Answer) {
		selectedAnswer = answer.text;
		answer.action();
	}
</script>

<h3>{question}</h3>
<div class="grid">
	{#each answers as answer (answer)}
		<div class={`s12 m${coloumSize} l${coloumSize}`}>
			<button
				onclick={() => selectAnswer(answer)}
				class:primary={selectedAnswer === answer.text}
				class:surface-container-highest={selectedAnswer !== answer.text}
			>
				<h6>{answer.text}</h6>
			</button>
		</div>
	{/each}
</div>

{#if info}
	<p><i>info</i> {info}</p>
{/if}

<style>
	button {
		width: 100%;
		box-sizing: border-box;
		height: 4rem;
	}
</style>
