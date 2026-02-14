<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Question from '$lib/components/Question.svelte';
	import { _ } from '$lib/i18n';
	import { clearCaches, isUnrestrictedPlatform, setInvidiousInstance } from '$lib/misc';
	import { isOwnBackend } from '$lib/shared';
	import { backendInUseStore, invidiousInstanceStore, playerYouTubeJsFallback } from '$lib/store';

	const defaultInstance = !isOwnBackend()
		? 'https://invidious.materialio.us'
		: $invidiousInstanceStore;

	let usingInvidious: boolean = $state(false);
	let invidiousInstanceValid: boolean = $state(true);
	let invidiousInstance: string = $state(defaultInstance ?? '');

	async function setupCompleted() {
		invidiousInstanceValid = await setInvidiousInstance(invidiousInstance);

		if (!invidiousInstanceValid) {
			return;
		}

		clearCaches();
		goto(resolve('/', {}), { replaceState: true });
		location.reload();
	}

	function setYTBackend() {
		usingInvidious = false;
		backendInUseStore.set('yt');
		setupCompleted();
	}
</script>

<nav class="center-align">
	<div class="setup">
		{#if !isUnrestrictedPlatform()}
			<p>
				<code>VITE_DEFAULT_INVIDIOUS_INSTANCE</code> has not been provided.
			</p>
			<p>
				Please read our <a
					href="https://github.com/Materialious/Materialious/blob/main/docs/DOCKER.md"
					referrerpolicy="no-referrer"
					class="link"
				>
					Docker guide
				</a>
				for configuring Materialious as a Invidious frontend.
			</p>
			<p>
				You will be required to reverse proxy Invidious & configure CORS too for Materialious to
				work.
			</p>
		{:else}
			<h3 class="center-align">{$_('initalSetup.required')}</h3>
			<div class="space"></div>
			<div class="divider"></div>
			<div class="space"></div>

			<Question
				question={$_('initalSetup.useInvidious')}
				answers={[
					{
						text: $_('initalSetup.yes'),
						action: () => {
							usingInvidious = true;
						}
					},
					{
						text: $_('initalSetup.no'),
						action: setYTBackend
					},
					{
						text: $_('initalSetup.unsure'),
						action: setYTBackend
					}
				]}
				info={$_('initalSetup.invidiousInfo')}
			/>

			{#if usingInvidious}
				<div class="space"></div>

				<Question
					question={$_('initalSetup.useLocalFallback')}
					answers={[
						{
							text: $_('initalSetup.yes'),
							action: () => {
								playerYouTubeJsFallback.set(true);
							}
						},
						{
							text: $_('initalSetup.no'),
							action: () => {
								playerYouTubeJsFallback.set(false);
							}
						},
						{
							text: $_('initalSetup.unsure'),
							action: () => {
								playerYouTubeJsFallback.set(true);
							}
						}
					]}
					info={$_('initalSetup.localFallbackInfo')}
				/>

				<div class="space"></div>
				<h3>{$_('initalSetup.configureInstance')}</h3>
				<div
					class="field label prefix surface-container-highest"
					class:invalid={!invidiousInstanceValid && invidiousInstance !== ''}
				>
					<i>link</i>
					<input bind:value={invidiousInstance} name="instanceUrl" type="text" tabindex="0" />
					<label for="instanceUrl" tabindex="-1">{$_('layout.instanceUrl')}</label>
					{#if !invidiousInstanceValid && invidiousInstance !== ''}
						<span class="error">{$_('invalidInstance')}</span>
					{/if}
				</div>

				<div class="space"></div>

				<button onclick={setupCompleted}>
					<i>done_all</i>
					<span>{$_('initalSetup.done')}</span>
				</button>
			{/if}
		{/if}
	</div>
</nav>

<style>
	.setup {
		width: 600px;
	}

	@media screen and (max-width: 600px) {
		.setup {
			width: 100%;
		}
	}
</style>
