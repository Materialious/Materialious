<script lang="ts">
	import { _ } from '$lib/i18n';
	import { onMount } from 'svelte';

	let ghContributors: { login: string; avatar_url: string; type: 'Bot' | 'User' }[] = $state([]);
	onMount(() => {
		fetch('/localApi/ghContributors.json', {
			priority: 'low'
		}).then(async (resp) => {
			if (!resp.ok) {
				return;
			}

			ghContributors = await resp.json();
		});
	});
</script>

<div class="grid">
	<div class="s12 m4 l4">
		<a href="https://github.com/sponsors/WardPearce" target="_blank" referrerpolicy="no-referrer">
			<article>
				<i>favorite</i>
				<span>{$_('donate')}</span>
			</article>
		</a>
	</div>
	<div class="s12 m4 l4">
		<a
			href="https://github.com/Materialious/Materialious"
			target="_blank"
			referrerpolicy="no-referrer"
		>
			<article>
				<i>code</i>
				<span>GitHub</span>
			</article>
		</a>
	</div>
	<div class="s12 m4 l4">
		<article>
			<span>{$_('version')}</span>
			<span>{import.meta.env.APP_VERSION}</span>
		</article>
	</div>
</div>

<h4>{$_('contributors')}</h4>

<div class="grid">
	{#each ghContributors as contributor (contributor)}
		{#if contributor.type === 'User'}
			<div class="s12 m4 l4">
				<article>
					<img class="circle" loading="lazy" src={contributor.avatar_url} alt={contributor.login} />
					<p>{contributor.login}</p>
				</article>
			</div>
		{/if}
	{/each}
</div>

<style>
	a,
	article {
		width: 100%;
		height: 100%;
	}
	article {
		display: flex;
		justify-content: center;
		align-items: center;
		flex-direction: column;
	}
</style>
