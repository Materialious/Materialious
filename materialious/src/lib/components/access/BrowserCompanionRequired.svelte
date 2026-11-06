<script lang="ts">
	import { _ } from '#lib/i18n/index';
	import { onMount } from 'svelte';
	import { Clipboard } from '@capacitor/clipboard';
	import Toast, { addToast } from '#lib/components/Toast.svelte';

	let instanceOrigin = $state('https://materialious.example.com');

	onMount(() => {
		instanceOrigin = window.location.origin;
	});

	async function copyInstanceUrl() {
		await Clipboard.write({ string: instanceOrigin });
		addToast({ data: { text: $_('player.share.copiedSuccess') } });
	}
</script>

<main class="companion-required" role="alert">
	<section class="notice">
		<h1>{$_('companionRequired.title')}</h1>
		<p>{$_('companionRequired.description')}</p>
		<p>{$_('companionRequired.installInstruction')}</p>
	</section>

	<div class="page-content">
		<section class="setup-guide" aria-labelledby="setup-heading">
			<article class="surface-container-high">
				<h2 id="setup-heading">{$_('companionRequired.setupTitle')}</h2>
				<ol>
					<li>{$_('companionRequired.setupStepOne')}</li>
					<li>
						{$_('companionRequired.setupStepTwo')}
						<span class="instance-url-row">
							<div class="field small border round instance-url-field">
								<input
									value={instanceOrigin}
									disabled
									aria-label={$_('companionRequired.instanceUrl')}
								/>
							</div>
							<button class="surface-container-highest" onclick={copyInstanceUrl}>
								<i>content_copy</i>
								{$_('companionRequired.copyUrl')}
							</button>
						</span>
					</li>
					<li>{$_('companionRequired.setupStepThree')}</li>
				</ol>
			</article>
		</section>

		<section class="downloads" aria-labelledby="download-heading">
			<article class="surface-container-high padding">
				<h2 id="download-heading">{$_('companionRequired.downloadTitle')}</h2>
				<div class="grid medium-space platforms">
					<div class="s12 m6 l4">
						<div class="platform-options" aria-labelledby="windows-heading">
							<h3 id="windows-heading">{$_('companionRequired.windows')}</h3>
							<a
								class="button surface-container-highest"
								href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-win32-x64.exe"
								>{$_('companionRequired.windowsX64')}</a
							>
							<a
								class="button surface-container-highest"
								href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-win32.exe"
								>{$_('companionRequired.windowsX32')}</a
							>
						</div>
					</div>
					<div class="s12 m6 l4">
						<div class="platform-options" aria-labelledby="android-heading">
							<h3 id="android-heading">{$_('companionRequired.android')}</h3>
							<a
								class="button surface-container-highest"
								href="https://f-droid.org/packages/us.materialio.app/"
								>{$_('companionRequired.fDroid')}</a
							>
							<a
								class="button surface-container-highest"
								href="https://apt.izzysoft.de/fdroid/index/apk/us.materialio.app"
								>{$_('companionRequired.izzyOnDroid')}</a
							>
							<a
								class="button surface-container-highest"
								href="https://github.com/Materialious/Materialious/releases/latest/download/app-universal-release-signed.apk"
								>{$_('companionRequired.apkUniversal')}</a
							>
							<a
								class="button surface-container-highest"
								href="https://github.com/Materialious/Materialious/releases/latest/download/app-x86_64-release-signed.apk"
								>{$_('companionRequired.apkX64')}</a
							>
							<a
								class="button surface-container-highest"
								href="https://github.com/Materialious/Materialious/releases/latest/download/app-arm64-v8a-release-signed.apk"
								>{$_('companionRequired.apkArm64')}</a
							>
							<a
								class="button surface-container-highest"
								href="https://apps.obtainium.imranr.dev/redirect.html?r=obtainium%3A%2F%2Fadd%2Fhttps%3A%2F%2Fgithub.com%2FMaterialious%2FMaterialious"
								>{$_('companionRequired.obtainium')}</a
							>
						</div>
					</div>
					<div class="s12 m6 l4">
						<div class="platform-options" aria-labelledby="linux-heading">
							<h3 id="linux-heading">{$_('companionRequired.linux')}</h3>
							<a
								class="button surface-container-highest"
								href="https://flathub.org/apps/us.materialio.Materialious"
								>{$_('companionRequired.flathub')}</a
							>
							<a class="button surface-container-highest" href="https://snapcraft.io/materialious"
								>{$_('companionRequired.snap')}</a
							>
							<a
								class="button surface-container-highest"
								href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-linux-amd64.deb"
								>{$_('companionRequired.debianUbuntu')}</a
							>
							<a
								class="button surface-container-highest"
								href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-linux-x86_64.rpm"
								>{$_('companionRequired.fedoraOpenSuse')}</a
							>
							<a
								class="button surface-container-highest"
								href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-linux-x86_64.AppImage"
								>{$_('companionRequired.appImage')}</a
							>
							<a
								class="button surface-container-highest"
								href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-linux-x64.7z"
								>{$_('companionRequired.tarball')}</a
							>
						</div>
					</div>
				</div>
			</article>
		</section>
	</div>
</main>

<Toast />

<style>
	.companion-required {
		box-sizing: border-box;
		width: 100%;
		min-height: 100dvh;
		padding: clamp(1rem, 4vw, 2rem);
		color: var(--on-background);
		background: var(--background);
	}

	.page-content {
		width: min(100%, 72rem);
		margin-inline: auto;
		display: grid;
		gap: 1.5rem;
	}

	.notice {
		width: min(100%, 72rem);
		margin: 0 auto 1.5rem;
	}

	.notice h1 {
		font-size: clamp(1.75rem, 5vw, 3.25rem);
		text-wrap: balance;
	}

	.setup-guide {
		min-width: 0;
	}

	.setup-guide article {
		padding: clamp(1rem, 3vw, 1.5rem);
		border-radius: 1.5rem;
	}

	.downloads > article {
		border-radius: 1.5rem;
	}

	.setup-guide ol {
		padding-inline-start: 1.5rem;
	}

	.setup-guide li + li {
		margin-block-start: 0.5rem;
	}

	.instance-url-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-block-start: 0.25rem;
	}

	.instance-url-field {
		min-width: 0;
		flex: 1;
		max-width: 30rem;
	}

	.downloads {
		min-width: 0;
	}

	.downloads h2 {
		margin-block-end: 0.75rem;
	}

	h1,
	h2,
	p {
		margin: 0 0 0.75rem;
	}

	.platforms {
		width: 100%;
	}

	.platform-options {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.5rem;
	}

	.platforms h3 {
		margin-block-end: 0.5rem;
	}

	.platforms a {
		width: 100%;
		box-sizing: border-box;
		min-height: 2.5rem;
		height: auto;
		justify-content: flex-start;
		text-align: start;
		white-space: normal;
	}

	@media (max-width: 600px) {
		.companion-required {
			padding: 1rem;
		}

		.page-content {
			gap: 1rem;
		}

		.instance-url-row {
			align-items: stretch;
		}

		.instance-url-field {
			flex-basis: 100%;
			max-width: none;
		}

		.instance-url-row button {
			width: 100%;
		}
	}
</style>
