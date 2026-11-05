<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { _ } from '#lib/i18n/index';
	import { isUnrestrictedPlatform, getMaterialiousBackendUrl } from '#lib/backend';
	import { setInvidiousInstance, setMaterialiousBackend, clearCaches } from '#lib/auth';
	import { isOwnBackend } from '#lib/shared/index';
	import { backendInUseStore, invidiousInstanceStore, playerYouTubeJsFallback } from '#lib/store';

	const defaultInstance = !isOwnBackend()
		? 'https://invidious.materialio.us'
		: $invidiousInstanceStore;

	let step = $state(0);
	let usingInvidious: boolean | undefined = $state(undefined);
	let invidiousInstanceValid: boolean = $state(true);
	let invidiousInstance: string = $state(defaultInstance ?? '');
	let materialiousBackend: string = $state(getMaterialiousBackendUrl());
	let invalidMaterialiousBackend: boolean = $state(false);
	let saving = $state(false);

	const stepNames = ['Backend', 'Player', 'Connections'];

	async function setupCompleted() {
		clearCaches();
		goto(resolve('/(app)'), { replace: true });
	}

	function chooseBackend(invidious: boolean) {
		usingInvidious = invidious;
		if (invidious) {
			backendInUseStore.set('ivg');
			step = 1;
		} else {
			backendInUseStore.set('yt');
			step = 2;
		}
	}

	async function saveConnections(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		invidiousInstanceValid = true;
		invalidMaterialiousBackend = false;

		try {
			if (usingInvidious) {
				if (!invidiousInstance.trim()) {
					invidiousInstanceValid = false;
					return;
				}
				invidiousInstanceValid = await setInvidiousInstance(invidiousInstance.trim());
				if (!invidiousInstanceValid) return;
			}

			if (materialiousBackend.trim()) {
				invalidMaterialiousBackend = !(await setMaterialiousBackend(materialiousBackend.trim()));
				if (invalidMaterialiousBackend) return;
			}

			await setupCompleted();
		} finally {
			saving = false;
		}
	}
</script>

<main class="setup-page">
	{#if !isUnrestrictedPlatform()}
		<section class="setup-card surface-container">
			<p><code>VITE_DEFAULT_INVIDIOUS_INSTANCE</code> has not been provided.</p>
			<p>
				Please read our <a
					href="https://github.com/Materialious/Materialious/blob/main/docs/DOCKER.md"
					referrerpolicy="no-referrer"
					class="link">Docker guide</a
				>
				for configuring Materialious as an Invidious frontend.
			</p>
			<p>You will need to reverse proxy Invidious and configure CORS for Materialious to work.</p>
		</section>
	{:else}
		<section class="setup-card surface-container">
			<header>
				<p class="eyebrow">Welcome to Materialious</p>
				<h1>Let’s get you set up</h1>
				<p class="muted">Choose how you want to watch. You can change these settings later.</p>
			</header>

			<nav class="stepper" aria-label="Setup progress">
				{#each stepNames as name, index (name)}
					<div
						class="center-align step-item"
						class:active={step === index}
						class:complete={step > index}
					>
						<button
							class="circle small step-circle"
							disabled={step < index}
							onclick={() => (step = index)}
						>
							{#if step > index}<i>done</i>{:else}{index + 1}{/if}
						</button>
						<div class="small-margin">{name}</div>
					</div>
					{#if index < stepNames.length - 1}<hr class="max" />{/if}
				{/each}
			</nav>

			{#if step === 0}
				<div class="step-content">
					<h2>{$_('initalSetup.useInvidious')}</h2>
					<p class="muted">{$_('initalSetup.invidiousInfo')}</p>
					<div class="choices">
						<button class="choice surface-container-highest" onclick={() => chooseBackend(true)}>
							<strong>{$_('initalSetup.yes')}</strong><span>Use an Invidious instance</span>
						</button>
						<button class="choice surface-container-highest" onclick={() => chooseBackend(false)}>
							<strong>{$_('initalSetup.no')}</strong><span>Use YouTube directly</span>
						</button>
						<button class="choice surface-container-highest" onclick={() => chooseBackend(false)}>
							<strong>{$_('initalSetup.unsure')}</strong><span>You can change this later</span>
						</button>
					</div>
				</div>
			{:else if step === 1}
				<div class="step-content">
					<h2>{$_('initalSetup.useLocalFallback')}</h2>
					<p class="muted">{$_('initalSetup.localFallbackInfo')}</p>
					<div class="choices two">
						<button
							class="choice surface-container-highest"
							onclick={() => {
								playerYouTubeJsFallback.set(true);
								step = 2;
							}}><strong>{$_('initalSetup.yes')}</strong></button
						>
						<button
							class="choice surface-container-highest"
							onclick={() => {
								playerYouTubeJsFallback.set(false);
								step = 2;
							}}><strong>{$_('initalSetup.no')}</strong></button
						>
					</div>
					<div class="space"></div>
					<button class="surface-container-highest" onclick={() => (step = 0)}>Back</button>
				</div>
			{:else}
				<div class="step-content">
					<h2>Connect your services</h2>
					<p class="muted">
						{usingInvidious
							? 'An Invidious instance is required. The Materialious backend is optional.'
							: 'The Materialious backend is optional.'}
					</p>
					<form onsubmit={saveConnections}>
						{#if usingInvidious}
							<div
								class="field label prefix surface-container-highest"
								class:invalid={!invidiousInstanceValid}
							>
								<i>link</i><input
									bind:value={invidiousInstance}
									id="instanceUrl"
									name="instanceUrl"
									type="url"
									required
								/>
								<label for="instanceUrl">{$_('invidiousInstance')}</label>
							</div>
						{/if}
						<div
							class="field label prefix surface-container-highest"
							class:invalid={invalidMaterialiousBackend}
						>
							<i>link</i><input
								bind:value={materialiousBackend}
								id="materialiousBackendUrl"
								name="materialiousBackendUrl"
								type="url"
							/>
							<label for="materialiousBackendUrl">{$_('materialiousBackendUrl')} (Optional)</label>
						</div>
						<div class="actions">
							<button
								type="button"
								class="surface-container-highest"
								onclick={() => (step = usingInvidious ? 1 : 0)}>Back</button
							>
							<button type="submit" class="primary" disabled={saving}
								>{saving ? 'Connecting…' : 'Finish setup'}<i>arrow_forward</i></button
							>
						</div>
					</form>
				</div>
			{/if}
		</section>
	{/if}
</main>

<style>
	.setup-page {
		min-height: 75vh;
		display: grid;
		place-items: center;
		padding: 2rem 1rem;
	}
	.setup-card {
		width: min(100%, 680px);
		box-sizing: border-box;
		padding: clamp(1.25rem, 4vw, 2.5rem);
		border-radius: 1.5rem;
	}
	header {
		text-align: center;
	}
	h1 {
		margin: 0.25rem 0;
		font-size: clamp(1.7rem, 4vw, 2.3rem);
	}
	.eyebrow {
		color: var(--primary);
		font-weight: 700;
		margin: 0;
	}
	.muted {
		opacity: 0.72;
	}
	.stepper {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin: 2rem 0;
	}
	.stepper hr {
		flex: 1;
		margin-top: 1rem;
	}
	.step-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 4.5rem;
		white-space: nowrap;
		opacity: 0.55;
		font-size: 0.9rem;
	}
	.step-item.active,
	.step-item.complete {
		opacity: 1;
	}
	.step-circle {
		flex: none;
	}
	.step-item.active .step-circle,
	.step-item.complete .step-circle {
		background-color: var(--primary);
		color: var(--on-primary);
	}
	.step-content h2 {
		margin-bottom: 0.25rem;
	}
	.choices {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
		margin-top: 1.5rem;
	}
	.choices.two {
		grid-template-columns: repeat(2, 1fr);
	}
	.choice {
		min-height: 8rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: 0.5rem;
		text-align: left;
		border-radius: 1rem;
	}
	.choice:hover {
		outline: 2px solid var(--primary);
	}
	.choice span {
		opacity: 0.7;
		font-size: 0.88rem;
	}
	.field {
		width: 100%;
	}
	.actions {
		display: flex;
		justify-content: space-between;
		margin-top: 1.5rem;
	}
	.actions button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	@media (max-width: 560px) {
		.step-item {
			font-size: 0.75rem;
			gap: 0.3rem;
		}
		.stepper {
			gap: 0.35rem;
		}
		.choices {
			grid-template-columns: 1fr;
		}
		.choices.two {
			grid-template-columns: 1fr;
		}
		.choice {
			min-height: 5rem;
		}
	}
</style>
