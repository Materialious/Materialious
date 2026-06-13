<script lang="ts">
	import { _ } from '$lib/i18n';
	import { onMount } from 'svelte';
	import { addToast } from '../Toast.svelte';

	type User = {
		id: string;
		username: string;
		created: string;
	};

	let users = $state<User[]>([]);
	let loading = $state(true);
	let error = $state('');

	async function loadUsers() {
		loading = true;
		error = '';
		try {
			const resp = await fetch('/api/admin/users');
			if (!resp.ok) throw new Error('Failed to load users');
			users = await resp.json();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	let pendingDeleteUser = $state<User | null>(null);
	let deletingUserId = $state<string | null>(null);

	async function confirmDelete() {
		if (!pendingDeleteUser) return;

		deletingUserId = pendingDeleteUser.id;
		pendingDeleteUser = null;
		try {
			const resp = await fetch(`/api/admin/users/${deletingUserId}`, { method: 'DELETE' });
			if (!resp.ok) throw new Error('Failed to delete user');
			users = users.filter((u) => u.id !== deletingUserId);
			addToast({
				data: { text: $_('layout.userDeleted') }
			});
		} catch (e) {
			error = (e as Error).message;
		} finally {
			deletingUserId = null;
		}
	}

	onMount(() => {
		loadUsers();
	});
</script>

<h5 class="no-margin">{$_('layout.adminPanel')}</h5>

<div class="space"></div>

{#if loading}
	<progress class="circle indeterminate small"></progress>
{:else if error}
	<div class="surface-container-highest" style="padding: 0.5rem; border-radius: 0.5rem;">
		{error}
	</div>
{:else}
	<p>{$_('layout.totalUsers', { count: users.length })}</p>

	<div class="space"></div>

	<div class="divider"></div>

	<div class="space"></div>

	{#each users as user (user.id)}
		<article class="no-margin surface-container-highest padding">
			<nav class="no-margin">
				<div class="max">
					<div>{user.username}</div>
					<small class="secondary-text">{new Date(user.created).toLocaleDateString()}</small>
				</div>
				<button
					class="tertiary"
					data-ui="#dialog-delete-user"
					disabled={deletingUserId === user.id}
					onclick={() => (pendingDeleteUser = user)}
				>
					<i>delete</i>
				</button>
			</nav>
		</article>
		<div class="small-space"></div>
	{/each}
{/if}

<dialog id="dialog-delete-user" class="surface-container padding">
	<h5 class="no-margin">{$_('layout.confirmDeleteUser')}</h5>
	<p>{$_('layout.confirmDeleteUserBody', { username: pendingDeleteUser?.username ?? '' })}</p>
	<nav class="no-margin">
		<button class="transparent" data-ui="#dialog-delete-user">{$_('cancel')}</button>
		<button class="tertiary" data-ui="#dialog-delete-user" onclick={confirmDelete}>
			{$_('delete')}
		</button>
	</nav>
</dialog>
