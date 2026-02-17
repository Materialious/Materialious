<script lang="ts">
	import { shareURL } from '$lib/misc';
	import { _ } from '$lib/i18n';
	import { invidiousInstanceStore } from '$lib/store';
	import { Capacitor } from '@capacitor/core';
	import { titleCase } from '$lib/letterCasing';

	type ShareLink = {
		type: 'invidious' | 'youtube' | 'materialious' | 'invidious redirect';
		path: string;
		param?: {
			key: string;
			value: () => string | number;
		};
	};

	let {
		shares,
		includePromptText = undefined,
		iconOnly = true
	}: {
		shares: ShareLink[];
		includePromptText?: string;
		iconOnly: boolean;
	} = $props();

	const shareBase = {
		invidious: $invidiousInstanceStore,
		youtube: 'https://www.youtube.com',
		materialious: !Capacitor.isNativePlatform() ? location.origin : undefined,
		'invidious redirect': 'https://redirect.invidious.io'
	};

	let includePrompt = $state(false);

	async function onShare(share: ShareLink) {
		const url = new URL(`${shareBase[share.type]}${share.path}`);

		if (share.param && includePrompt)
			url.searchParams.append(share.param.key, share.param.value().toString());

		await shareURL(url.toString());
	}
</script>

<button class="surface-container-highest" onclick={(event: Event) => event.stopPropagation()}>
	<i>share</i>
	{#if !iconOnly}
		{$_('player.share.title')}
	{/if}
	<div class="tooltip">
		{$_('player.share.title')}
	</div>
	<menu class="no-wrap mobile" data-ui="#share-menu" id="share-menu">
		{#if includePromptText}
			<li class="row">
				<label class="switch">
					<input type="checkbox" bind:checked={includePrompt} />
					<span></span>
				</label>
				<div class="min">{includePromptText}</div>
			</li>
			<div class="divider"></div>
		{/if}

		{#each shares as share (share)}
			{#if shareBase[share.type]}
				<li
					data-ui="#share-menu"
					class="row"
					role="presentation"
					onclick={() => {
						onShare(share);
					}}
				>
					<div class="min">
						{$_('player.share.copyXLink', {
							linkType: titleCase(share.type)
						})}
					</div>
				</li>
			{/if}
		{/each}
	</menu>
</button>
