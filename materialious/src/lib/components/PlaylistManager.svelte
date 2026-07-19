<script lang="ts">
	import {
		addPlaylistVideo,
		ensurePersonalPlaylists,
		getPersonalPlaylists,
		removePlaylistVideo
	} from '$lib/api';
	import type { PlaylistPage } from '$lib/api/model';
	import { _ } from '$lib/i18n';
	import {
		invidiousAuthStore,
		personalPlaylistsCacheStore
	} from '$lib/store';
	import { isYTBackend } from '$lib/misc';

	interface Props {
		mode: 'toggle' | 'clone';
		videoId?: string;
		videoIds?: string[];
		buttonText?: string;
		buttonIcon?: string;
		buttonClasses?: string;
		menuClasses?: string;
		inline?: boolean;
		onComplete?: () => void;
	}

	let {
		mode,
		videoId,
		videoIds,
		buttonText,
		buttonIcon = 'add',
		buttonClasses = 'surface-container-highest',
		menuClasses = '',
		inline = false,
		onComplete
	}: Props = $props();

	const dialogId = `playlist-manager-${Math.random().toString(36).slice(2, 8)}`;

	let searchQuery = $state('');
	let working = $state(false);
	let workingPlaylistId = $state<string | null>(null);
	let dialogEl: HTMLDialogElement | undefined = $state();
	let canManage = $derived($invidiousAuthStore && !isYTBackend());

	$effect(() => {
		ensurePersonalPlaylists();
	});

	let filteredPlaylists = $derived.by(() => {
		const playlists = $personalPlaylistsCacheStore ?? [];
		if (!searchQuery.trim()) return playlists;
		const q = searchQuery.toLowerCase();
		return playlists.filter((p) => p.title.toLowerCase().includes(q));
	});

	let displayPlaylists = $derived(
		inline ? ($personalPlaylistsCacheStore ?? []) : filteredPlaylists
	);

	function videoInPlaylist(playlist: PlaylistPage): boolean {
		if (!videoId) return false;
		return playlist.videos.some((v) => v.videoId === videoId);
	}

	function open() {
		if (!canManage) return;
		searchQuery = '';
		dialogEl?.showModal();
	}

	function close() {
		dialogEl?.close();
	}

	function onBackdropClick(e: MouseEvent) {
		if (e.target === dialogEl) close();
	}

	async function handleToggle(playlist: PlaylistPage) {
		if (working || !videoId) return;
		working = true;
		workingPlaylistId = playlist.playlistId;
		try {
			const existing = playlist.videos.filter((v) => v.videoId === videoId);
			if (existing.length > 0) {
				for (const v of existing) {
					await removePlaylistVideo(playlist.playlistId, v.indexId);
				}
			} else {
				await addPlaylistVideo(playlist.playlistId, videoId);
			}
			personalPlaylistsCacheStore.set(await getPersonalPlaylists());
		} catch {
			// Continue regardless of error
		}
		working = false;
		workingPlaylistId = null;
		onComplete?.();
	}

	async function handleClone(playlist: PlaylistPage) {
		if (working || !videoIds?.length) return;
		working = true;
		workingPlaylistId = playlist.playlistId;
		try {
			await Promise.all(
				videoIds.map((id) => addPlaylistVideo(playlist.playlistId, id))
			);
			personalPlaylistsCacheStore.set(await getPersonalPlaylists());
		} catch {
			// Continue regardless of error
		}
		working = false;
		workingPlaylistId = null;
		onComplete?.();
	}
</script>

{#if inline}
	{#if canManage}
		<button class={buttonClasses}>
			<i>{buttonIcon}</i>
			{#if buttonText}
				<span>{buttonText}</span>
			{/if}
			<menu class={menuClasses}>
				{#if displayPlaylists.length > 0}
					{#each displayPlaylists as personalPlaylist (personalPlaylist.playlistId)}
						<li
							role="presentation"
							class="row"
							onclick={() =>
								mode === 'toggle'
									? handleToggle(personalPlaylist)
									: handleClone(personalPlaylist)}
						>
							<span class="max">{personalPlaylist.title}</span>
							{#if working && workingPlaylistId === personalPlaylist.playlistId}
								<i>hourglass_empty</i>
							{:else if mode === 'toggle'}
								{#if videoInPlaylist(personalPlaylist)}
									<i>close</i>
								{:else}
									<i>add</i>
								{/if}
							{:else}
								<i>content_copy</i>
							{/if}
						</li>
					{/each}
				{:else}
					<li class="row">
						<span>{$_('player.noPlaylists')}</span>
					</li>
				{/if}
			</menu>
		</button>
	{:else}
		<button disabled class={buttonClasses}>
			<i>{buttonIcon}</i>
			{#if buttonText}
				<span>{buttonText}</span>
			{/if}
		</button>
	{/if}
{:else}
	<button class={buttonClasses} disabled={!canManage} onclick={open}>
		<i>{buttonIcon}</i>
		{#if buttonText}
			<span>{buttonText}</span>
		{/if}
	</button>

	<dialog id={dialogId} bind:this={dialogEl} onclick={onBackdropClick} class="padding">
		<nav class="no-space">
			<h6 class="max">{mode === 'toggle' ? $_('player.addToPlaylist') : $_('playlist.cloneToPlaylist')}</h6>
			<button onclick={close} class="circle transparent">
				<i>close</i>
			</button>
		</nav>

		<div class="space"></div>

		<div class="field prefix fill no-margin round">
			<i class="front">search</i>
			<input
				placeholder={$_('searchPlaceholder')}
				bind:value={searchQuery}
			/>
		</div>

		<div class="space"></div>

		<div class="playlist-list">
			{#if displayPlaylists.length > 0}
				{#each displayPlaylists as personalPlaylist (personalPlaylist.playlistId)}
					<button
						class="transparent row max"
						disabled={working && workingPlaylistId !== personalPlaylist.playlistId}
						onclick={() =>
							mode === 'toggle'
								? handleToggle(personalPlaylist)
								: handleClone(personalPlaylist)}
					>
						<nav class="max">
							<span class="max">{personalPlaylist.title}</span>
							{#if working && workingPlaylistId === personalPlaylist.playlistId}
								<i>hourglass_empty</i>
							{:else if mode === 'toggle'}
								{#if videoInPlaylist(personalPlaylist)}
									<i>close</i>
								{:else}
									<i>add</i>
								{/if}
							{:else}
								<i>content_copy</i>
							{/if}
						</nav>
					</button>
				{/each}
			{:else}
				<p class="center-align small-text">{$_('player.noPlaylists')}</p>
			{/if}
		</div>
	</dialog>
{/if}

<style>
	.playlist-list {
		display: flex;
		flex-direction: column;
		max-height: 300px;
		overflow-y: auto;
	}

	.playlist-list button {
		justify-content: space-between;
		text-align: left;
	}
</style>
