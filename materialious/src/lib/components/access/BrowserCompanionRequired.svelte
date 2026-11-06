<script lang="ts">
	import { _ } from '#lib/i18n/index';
</script>

<main class="companion-required" role="alert">
	<section class="notice">
		<h1>{$_('companionRequired.title')}</h1>
		<p>
			{$_('companionRequired.description')}
		</p>
		<p>{$_('companionRequired.installInstruction')}</p>
	</section>

	<section class="downloads" aria-labelledby="download-heading">
		<h2 id="download-heading">{$_('companionRequired.downloadTitle')}</h2>
		<div class="grid medium-space platforms">
			<div class="s12 m6 l4">
				<article aria-labelledby="windows-heading">
					<h3 id="windows-heading">{$_('companionRequired.windows')}</h3>
					<a
						href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-win32-x64.exe"
						>{$_('companionRequired.windowsX64')}</a
					>
					<a
						href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-win32.exe"
						>{$_('companionRequired.windowsX32')}</a
					>
				</article>
			</div>
			<div class="s12 m6 l4">
				<article aria-labelledby="android-heading">
					<h3 id="android-heading">{$_('companionRequired.android')}</h3>
					<a href="https://f-droid.org/packages/us.materialio.app/"
						>{$_('companionRequired.fDroid')}</a
					>
					<a href="https://apt.izzysoft.de/fdroid/index/apk/us.materialio.app"
						>{$_('companionRequired.izzyOnDroid')}</a
					>
					<a
						href="https://github.com/Materialious/Materialious/releases/latest/download/app-universal-release-signed.apk"
						>{$_('companionRequired.apkUniversal')}</a
					>
					<a
						href="https://github.com/Materialious/Materialious/releases/latest/download/app-x86_64-release-signed.apk"
						>{$_('companionRequired.apkX64')}</a
					>
					<a
						href="https://github.com/Materialious/Materialious/releases/latest/download/app-arm64-v8a-release-signed.apk"
						>{$_('companionRequired.apkArm64')}</a
					>
					<a
						href="https://apps.obtainium.imranr.dev/redirect.html?r=obtainium%3A%2F%2Fadd%2Fhttps%3A%2F%2Fgithub.com%2FMaterialious%2FMaterialious"
						>{$_('companionRequired.obtainium')}</a
					>
				</article>
			</div>
			<div class="s12 m6 l4">
				<article aria-labelledby="linux-heading">
					<h3 id="linux-heading">{$_('companionRequired.linux')}</h3>
					<a href="https://flathub.org/apps/us.materialio.Materialious"
						>{$_('companionRequired.flathub')}</a
					>
					<a href="https://snapcraft.io/materialious">{$_('companionRequired.snap')}</a>
					<a
						href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-linux-amd64.deb"
						>{$_('companionRequired.debianUbuntu')}</a
					>
					<a
						href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-linux-x86_64.rpm"
						>{$_('companionRequired.fedoraOpenSuse')}</a
					>
					<a
						href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-linux-x86_64.AppImage"
						>{$_('companionRequired.appImage')}</a
					>
					<a
						href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-linux-x64.7z"
						>{$_('companionRequired.tarball')}</a
					>
				</article>
			</div>
		</div>
	</section>
</main>

<style>
	.companion-required {
		box-sizing: border-box;
		width: 100%;
		min-height: 100dvh;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 2rem;
		padding: clamp(1rem, 4vw, 2rem);
		text-align: center;
		color: var(--on-background);
		background: var(--background);
	}

	.notice {
		width: min(100%, 60rem);
	}

	.notice h1 {
		font-size: clamp(1.75rem, 5vw, 3.25rem);
		text-wrap: balance;
	}

	.downloads {
		width: 100%;
	}

	h1,
	h2,
	p {
		margin: 0 0 0.75rem;
	}

	.platforms {
		width: 100%;
	}

	.platforms article {
		box-sizing: border-box;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: var(--border-radius, 0.75rem);
		background: var(--surface-container-high);
	}

	.platforms h3 {
		margin: 0 0 0.25rem;
	}

	.platforms a {
		color: var(--primary);
		text-decoration: none;
	}
</style>
