<script lang="ts">
	import { shareURL } from '$lib/misc';
	import { _ } from '$lib/i18n';
	import { invidiousInstanceStore } from '$lib/store';
	import { Capacitor } from '@capacitor/core';
	import { sentenceCase } from '$lib/letterCasing';

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
		iconOnly = true,
		classes = 'surface-container-highest',
		menuClasses = 'mobile no-wrap',
		onShare = undefined
	}: {
		shares: ShareLink[];
		includePromptText?: string;
		iconOnly: boolean;
		classes?: string;
		menuClasses?: string;
		onShare?: (value: string) => void;
	} = $props();

	const shareBase = {
		invidious: $invidiousInstanceStore,
		youtube: 'https://www.youtube.com',
		materialious: !Capacitor.isNativePlatform() ? location.origin : undefined,
		'invidious redirect': 'https://redirect.invidious.io'
	};

	let shareButtonElement: HTMLElement | undefined = $state();
	let includePrompt = $state(false);

	async function onShareValue(share: ShareLink) {
		const url = new URL(`${shareBase[share.type]}${share.path}`);

		if (share.param && includePrompt)
			url.searchParams.append(share.param.key, share.param.value().toString());

		onShare?.(url.toString());

		await shareURL(url.toString());

		shareButtonElement?.click();
	}
</script>

<button bind:this={shareButtonElement} class={classes}>
	<i>share</i>
	{#if !iconOnly}
		{$_('player.share.title')}
	{/if}
	<div class="tooltip">
		{$_('player.share.title')}
	</div>
	<menu class={menuClasses} data-ui="#share-menu" id="share-menu">
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
						onShareValue(share);
					}}
				>
					<div class="min">
						{$_('player.share.copyXLink', {
							linkType: sentenceCase(share.type)
						})}
					</div>
				</li>
			{/if}
		{/each}
	</menu>
</button>
