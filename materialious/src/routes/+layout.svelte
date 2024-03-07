<script lang="ts">
	import Logo from '$lib/Logo.svelte';

	import 'beercss';
	import 'material-dynamic-colors';

	const pages = [
		{
			icon: 'home',
			href: '/',
			name: 'Home'
		},
		{
			icon: 'whatshot',
			href: '/trending',
			name: 'Trending'
		},
		{
			icon: 'subscriptions',
			href: '/subscriptions',
			name: 'Subscriptions'
		},
		{
			icon: 'video_library',
			href: '/playlists',
			name: 'Playlists'
		},
		{
			icon: 'history',
			href: '/history',
			name: 'history'
		}
	];
</script>

<nav class="left m l small">
	<header></header>
	{#each pages as page}
		<a href={page.href}
			><i>{page.icon}</i>
			<div>{page.name}</div>
		</a>
	{/each}
</nav>

<nav class="top">
	<button class="circle large transparent s m l small-margin" data-ui="#dialog-expanded"
		><i>menu</i></button
	>

	<Logo />
	<h6 class="m l">Materialious</h6>

	<div class="max"></div>
	<div class="max field round suffix prefix small no-margin m l white black-text">
		<i class="front">search</i><input type="text" placeholder="Search..." />
	</div>
	<div class="max"></div>
	<button class="circle large transparent" data-ui="#dialog-notifications"
		><i>notifications</i></button
	>
	<button class="circle large transparent" data-ui="#dialog-settings"><i>settings</i></button>
	<button class="circle large transparent"><i>login</i></button>
</nav>

<dialog class="right" id="dialog-settings">
	<nav>
		<h5 class="max">Settings</h5>
		<button class="circle transparent" data-ui="#dialog-settings"><i>close</i></button>
	</nav>
	<p>Customize Materialious</p>
</dialog>

<dialog class="right" id="dialog-notifications">
	<nav>
		<h5 class="max">Notifications</h5>
		<button class="circle transparent" data-ui="#dialog-notifications"><i>close</i></button>
	</nav>
	<p>No new notifications here</p>
</dialog>

<dialog class="left small" id="dialog-expanded">
	<header class="fixed">
		<nav>
			<button class="transparent circle large" data-ui="#dialog-expanded"><i>menu</i></button>
			<div style="width: 20%;">
				<Logo />
			</div>
			<h6>Materialious</h6>
		</nav>
	</header>
	{#each pages as page}
		<a class="row round" data-ui="#dialog-expanded" href={page.href}
			><i>{page.icon}</i>
			<div>{page.name}</div></a
		>
	{/each}
</dialog>

<main class="responsive max">
	<slot />
</main>

<style>
	nav.left a {
		font-size: 0.8em;
	}
</style>
