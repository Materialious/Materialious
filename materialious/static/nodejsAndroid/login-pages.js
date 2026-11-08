// HTML for the pages the phone/PC sees during TV QR login. Mirrors the app's
// BeerCSS / Material 3 look using the live theme colors sent by the WebView.
// Plain HTML + CSS, no JS and no external resources (strict CSP).

const THEME_KEYS = [
	'primary',
	'on-primary',
	'primary-container',
	'on-primary-container',
	'surface',
	'surface-container',
	'surface-container-highest',
	'on-surface',
	'on-surface-variant',
	'outline',
	'outline-variant',
	'error',
	'on-error'
];

// Only plain hex / rgb(a) colors are ever inlined into the stylesheet.
const COLOR_REGEX =
	/^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*(,\s*\d{1,3}\s*){2}(,\s*(0|1|0?\.\d+)\s*)?\))$/;

const DEFAULT_LANG = 'en';
const LANG_REGEX = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/;

const DEFAULT_STRINGS = {
	title: 'Login to Materialious',
	instruction: 'Enter the code shown on your TV, then sign in to Invidious and approve.',
	codeLabel: 'Code',
	continue: 'Continue',
	wrongCode: 'Wrong code. Try again.',
	tooManyAttempts: 'Too many wrong attempts. A new code was generated, check your TV.',
	redirecting: 'Taking you to Invidious',
	redirectingHint: 'Sign in and approve the request. If nothing happens, use the button.',
	redirectingAction: 'Continue to Invidious',
	doneTitle: 'Done',
	doneBody: 'You are logged in. You can go back to the TV.',
	expiredTitle: 'Login expired',
	expiredBody: 'This login request expired. Start it again on your TV.',
	invalidTitle: 'Login failed',
	invalidBody: 'This login link is no longer valid. Start it again on your TV.'
};

// Material Symbols paths (24px), inlined so the page needs no icon font.
const ICONS = {
	tv: 'M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .89-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm0 14H3V8h18v12z',
	key: 'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
	check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
	schedule:
		'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
	warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'
};

function badge(icon) {
	return `<div class="badge" aria-hidden="true"><svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="${ICONS[icon]}"/></svg></div>`;
}

function escapeHtml(value) {
	return String(value).replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
	);
}

// Keeps only known theme keys whose values look like colors.
function sanitizeTheme(theme) {
	const vars = {};
	const input = theme && typeof theme.vars === 'object' && theme.vars ? theme.vars : {};
	for (const key of THEME_KEYS) {
		const value = typeof input[key] === 'string' ? input[key].trim() : '';
		if (COLOR_REGEX.test(value)) vars[key] = value;
	}
	return { vars, dark: !!(theme && theme.dark) };
}

// Keeps only known string keys; everything is escaped at render time.
function sanitizeStrings(strings) {
	const clean = { ...DEFAULT_STRINGS };
	if (strings && typeof strings === 'object') {
		for (const key of Object.keys(DEFAULT_STRINGS)) {
			if (typeof strings[key] === 'string' && strings[key].length < 500) clean[key] = strings[key];
		}
	}
	return clean;
}

function sanitizeLang(lang) {
	return typeof lang === 'string' && LANG_REGEX.test(lang) ? lang : DEFAULT_LANG;
}

// Fallbacks are the BeerCSS default (light) palette.
const FALLBACK_LIGHT = {
	primary: '#6750a4',
	'on-primary': '#ffffff',
	'primary-container': '#e9ddff',
	'on-primary-container': '#22005d',
	surface: '#fdf8fd',
	'surface-container': '#f1ecf1',
	'surface-container-highest': '#e6e1e6',
	'on-surface': '#1c1b1e',
	'on-surface-variant': '#49454e',
	outline: '#7a757f',
	'outline-variant': '#cac4cf',
	error: '#ba1a1a',
	'on-error': '#ffffff'
};

function render(options, title, content, extraHead = '') {
	const theme = sanitizeTheme(options.theme);
	const vars = { ...FALLBACK_LIGHT, ...theme.vars };
	const rootVars = Object.entries(vars)
		.map(([key, value]) => `--${key}:${value}`)
		.join(';');
	const lang = sanitizeLang(options.lang);

	return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="${theme.dark ? 'dark' : 'light'}">
<title>${escapeHtml(title)}</title>
${extraHead}
<style>
:root{${rootVars};color-scheme:${theme.dark ? 'dark' : 'light'}}
*{box-sizing:border-box}
html{background:var(--surface)}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--surface);color:var(--on-surface);font-family:Inter,Roboto,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:1rem;line-height:1.5}
main{width:100%;max-width:28rem;background:var(--surface-container);border-radius:.75rem;padding:24px 16px}
.badge{display:flex;align-items:center;justify-content:center;width:56px;height:56px;margin-bottom:16px;border-radius:50%;background:var(--primary-container);color:var(--on-primary-container)}
h1{margin:0 0 8px;font-size:1.5rem;font-weight:500;line-height:2rem}
p{margin:0 0 16px;color:var(--on-surface-variant)}
form{margin:0}
.field{position:relative;margin:24px 0 16px}
.field input{display:block;width:100%;height:56px;padding:0 16px;border:1px solid var(--outline);border-radius:.25rem;background:transparent;color:var(--on-surface);font:inherit;font-size:1.25rem;letter-spacing:.3em;text-transform:uppercase}
.field input::placeholder{color:transparent}
.field label{position:absolute;left:12px;top:50%;padding:0 4px;max-width:calc(100% - 24px);transform:translateY(-50%);background:var(--surface-container);color:var(--on-surface-variant);font-size:1rem;pointer-events:none;transition:all .15s ease}
.field input:focus,.field input:not(:placeholder-shown){border-color:var(--outline)}
.field input:focus{border:2px solid var(--primary);padding:0 15px}
.field input:focus+label,.field input:not(:placeholder-shown)+label{top:0;font-size:.75rem}
.field input:focus+label{color:var(--primary)}
.field.invalid input,.field.invalid input:focus{border-color:var(--error)}
.field.invalid label,.field.invalid input:focus+label{color:var(--error)}
.helper{display:block;margin:-8px 0 16px;padding:0 16px;color:var(--error);font-size:.875rem}
button,.button{display:inline-flex;align-items:center;justify-content:center;width:100%;min-height:48px;padding:0 24px;border:0;border-radius:2rem;background:var(--primary);color:var(--on-primary);font:inherit;font-weight:500;text-decoration:none;cursor:pointer}
button:hover,.button:hover{filter:brightness(1.08)}
:focus-visible{outline:3px solid var(--primary);outline-offset:3px}
.field input:focus-visible{outline:none}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
@media (min-width:600px){main{padding:32px 24px}}
</style>
</head>
<body>
<main>
${content}
</main>
</body>
</html>`;
}

function codeForm(options, errorKey) {
	options = options || {};
	const s = sanitizeStrings(options.strings);
	const error = errorKey ? escapeHtml(s[errorKey]) : '';
	return render(
		options,
		s.title,
		`${badge('tv')}
<h1>${escapeHtml(s.title)}</h1>
<p id="hint">${escapeHtml(s.instruction)}</p>
<form method="GET" action="/go">
	<div class="field${error ? ' invalid' : ''}">
		<input id="code" name="c" type="text" placeholder=" " maxlength="6" minlength="6" required autofocus
			autocomplete="one-time-code" autocapitalize="characters" autocorrect="off" spellcheck="false"
			inputmode="text" aria-describedby="${error ? 'error hint' : 'hint'}"${error ? ' aria-invalid="true"' : ''}>
		<label for="code">${escapeHtml(s.codeLabel)}</label>
	</div>
	${error ? `<span class="helper" id="error" role="alert">${error}</span>` : ''}
	<button type="submit">${escapeHtml(s.continue)}</button>
</form>`
	);
}

function message(options, titleKey, bodyKey, icon) {
	options = options || {};
	const s = sanitizeStrings(options.strings);
	return render(
		options,
		s[titleKey],
		`${badge(icon)}
<h1>${escapeHtml(s[titleKey])}</h1>
<p>${escapeHtml(s[bodyKey])}</p>`
	);
}

// Interstitial before Invidious. The refresh target is the already-built
// authorize URL; the button covers browsers that ignore meta refresh.
function redirecting(options, url) {
	options = options || {};
	const s = sanitizeStrings(options.strings);
	const safeUrl = escapeHtml(url);
	return render(
		options,
		s.redirecting,
		`${badge('key')}
<h1>${escapeHtml(s.redirecting)}</h1>
<p>${escapeHtml(s.redirectingHint)}</p>
<a class="button" href="${safeUrl}">${escapeHtml(s.redirectingAction)}</a>`,
		`<meta http-equiv="refresh" content="0;url=${safeUrl}">`
	);
}

module.exports = {
	codeForm,
	redirecting,
	done: (options) => message(options, 'doneTitle', 'doneBody', 'check'),
	expired: (options) => message(options, 'expiredTitle', 'expiredBody', 'schedule'),
	invalid: (options) => message(options, 'invalidTitle', 'invalidBody', 'warning'),
	sanitizeTheme,
	sanitizeStrings,
	sanitizeLang
};
