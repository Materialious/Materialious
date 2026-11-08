<script lang="ts">
	type Status = 'form' | 'done' | 'expired' | 'invalid';

	interface State {
		status: Status;
		error?: 'wrongCode' | 'tooManyAttempts';
		theme: { vars: Record<string, string>; dark: boolean };
		strings: Record<string, string>;
		lang: string;
	}

	const state: State = JSON.parse(document.getElementById('state')?.textContent ?? '{}');
	const s = state.strings;
	const error = state.error ? s[state.error] : '';

	const titles: Record<Status, string> = {
		form: s.title,
		done: s.doneTitle,
		expired: s.expiredTitle,
		invalid: s.invalidTitle
	};
	const bodies: Record<Status, string> = {
		form: s.instruction,
		done: s.doneBody,
		expired: s.expiredBody,
		invalid: s.invalidBody
	};
	const icons: Record<Status, string> = {
		form: 'M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .89-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm0 14H3V8h18v12z',
		done: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
		expired:
			'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
		invalid: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'
	};

	// Same Material colors as the TV; inline on body so they win over BeerCSS' defaults.
	document.documentElement.lang = state.lang;
	document.title = titles[state.status];
	document.body.classList.add(state.theme.dark ? 'dark' : 'light');
	for (const [name, value] of Object.entries(state.theme.vars)) {
		document.body.style.setProperty(`--${name}`, value);
	}
</script>

<main>
	<article class="border round no-elevate left-align">
		<div class="icon-badge circle large primary-container">
			<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true">
				<path d={icons[state.status]} />
			</svg>
		</div>
		<h5>{titles[state.status]}</h5>
		<p id="hint">{bodies[state.status]}</p>

		{#if state.status === 'form'}
			<form method="GET" action="/go">
				<div class="field label border" class:invalid={!!error}>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="code"
						name="c"
						type="text"
						placeholder=" "
						maxlength="6"
						minlength="6"
						required
						autofocus
						autocomplete="one-time-code"
						autocapitalize="characters"
						autocorrect="off"
						spellcheck="false"
						inputmode="text"
						aria-describedby={error ? 'error hint' : 'hint'}
						aria-invalid={error ? 'true' : undefined}
					/>
					<label for="code">{s.codeLabel}</label>
					{#if error}
						<span class="helper error-text" id="error" role="alert">{error}</span>
					{/if}
				</div>
				<button class="responsive large" type="submit">{s.continue}</button>
			</form>
		{/if}
	</article>
</main>

<style>
	main {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 1rem;
	}

	article {
		width: 100%;
		max-width: 28rem;
	}

	.icon-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.5rem;
		height: 3.5rem;
		margin: 0 0 1rem;
	}

	.field {
		margin-bottom: 1.5rem;
	}

	input {
		font-size: 1.25rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
	}

	:global(:focus-visible) {
		outline: 3px solid var(--primary);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(*) {
			transition: none !important;
			animation: none !important;
		}
	}
</style>
