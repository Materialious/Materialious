const http = require('http');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Short-lived listener for TV QR login. Unlike the proxy in index.js this one
// is reachable from the LAN on purpose, but only serves the login handshake,
// only while the TV login page is open, and only for a single secret.

const PORT = 3001;
const SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_WRONG_CODE_ATTEMPTS = 5;
// Unambiguous alphabet: no 0/O/1/I.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const AUTH_SCOPES = ':feed,:subscriptions*,:playlists*,:history*,:notifications*';

let server = null;
let session = null;
// Kept after stop so late visitors still get a themed, translated page.
let lastSession = null;

function generateCode() {
	const bytes = crypto.randomBytes(6);
	let code = '';
	for (let i = 0; i < 6; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
	return code;
}

function ownIpAddresses() {
	const addresses = new Set();
	for (const interfaces of Object.values(os.networkInterfaces())) {
		for (const entry of interfaces || []) {
			if (entry.family === 'IPv4' && !entry.internal) addresses.add(entry.address);
		}
	}
	return addresses;
}

function isExpired() {
	return !session || Date.now() > session.expiresAt;
}

// The browser's Host header decides which address the callback_url uses (the
// phone may reach the TV over LAN or Tailscale). Reject hosts that are not
// one of this device's own addresses, so a spoofed Host cannot steal the
// token by pointing the callback at another machine.
function hostIsOwn(req) {
	const hostname = (req.headers.host || '').split(':')[0];
	return ownIpAddresses().has(hostname);
}

// The phone/PC UI is the Svelte app built from src/tv-login-web into one HTML
// file (scripts/buildTvLoginWeb.mjs). Its inline script/style are allowed by
// sha256 hash; the session state is injected as an inert JSON block.
let template = null;
let cspHashes = '';

function loadTemplate() {
	if (template) return;
	template = fs.readFileSync(path.join(__dirname, 'login-web.html'), 'utf8');
	const hash = (text) => `'sha256-${crypto.createHash('sha256').update(text).digest('base64')}'`;
	const script = template.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
	const style = template.match(/<style>([\s\S]*?)<\/style>/)[1];
	cspHashes = `script-src ${hash(script)}; style-src ${hash(style)}`;
}

// Only plain hex / rgb(a) colors and plain variable names are ever sent to the page.
const COLOR_REGEX =
	/^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*(,\s*\d{1,3}\s*){2}(,\s*(0|1|0?\.\d+)\s*)?\))$/;
const VAR_NAME_REGEX = /^[a-z][a-z-]{0,40}$/;
const LANG_REGEX = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/;

const DEFAULT_STRINGS = {
	title: 'Login to Materialious',
	instruction: 'Enter the code shown on your TV, then sign in to Invidious and approve.',
	codeLabel: 'Code',
	continue: 'Continue',
	wrongCode: 'Wrong code. Try again.',
	tooManyAttempts: 'Too many wrong attempts. A new code was generated, check your TV.',
	doneTitle: 'Done',
	doneBody: 'You are logged in. You can go back to the TV.',
	expiredTitle: 'Login expired',
	expiredBody: 'This login request expired. Start it again on your TV.',
	invalidTitle: 'Login failed',
	invalidBody: 'This login link is no longer valid. Start it again on your TV.'
};

function sanitizeTheme(theme) {
	const vars = {};
	const input = theme && typeof theme.vars === 'object' && theme.vars ? theme.vars : {};
	for (const [key, raw] of Object.entries(input)) {
		const name = key.replace(/^--/, '').trim();
		const value = typeof raw === 'string' ? raw.trim() : '';
		if (VAR_NAME_REGEX.test(name) && COLOR_REGEX.test(value)) vars[name] = value;
	}
	return { vars, dark: !!(theme && theme.dark) };
}

function sanitizeStrings(strings) {
	const clean = { ...DEFAULT_STRINGS };
	if (strings && typeof strings === 'object') {
		for (const key of Object.keys(DEFAULT_STRINGS)) {
			if (typeof strings[key] === 'string' && strings[key].length < 500) clean[key] = strings[key];
		}
	}
	return clean;
}

function securityHeaders(extraFormAction) {
	return {
		'Content-Type': 'text/html; charset=utf-8',
		// form-action also covers the redirect from /go to the Invidious instance.
		'Content-Security-Policy': `default-src 'none'; ${cspHashes}; form-action 'self' ${extraFormAction}; base-uri 'none'; frame-ancestors 'none'`,
		'Cache-Control': 'no-store',
		'Referrer-Policy': 'no-referrer',
		'X-Content-Type-Options': 'nosniff'
	};
}

function sendPage(res, status, state, error) {
	const data = state || {};
	loadTemplate();
	const payload = JSON.stringify({
		status: status.view,
		error,
		theme: data.theme || { vars: {}, dark: false },
		strings: data.strings || DEFAULT_STRINGS,
		lang: data.lang || 'en'
	}).replace(/</g, '\\u003c');
	let origin = '';
	try {
		origin = new URL(data.instance).origin;
	} catch {
		// No usable instance: only same-origin forms.
	}
	res.writeHead(status.code, securityHeaders(origin));
	res.end(template.replace('__STATE__', () => payload));
}

const view = {
	form: { view: 'form', code: 200 },
	done: { view: 'done', code: 200 },
	expired: { view: 'expired', code: 410 },
	invalid: { view: 'invalid', code: 403 }
};

function redirectAuthorize(res, req) {
	const secret = encodeURIComponent(session.secret);
	const callbackUrl = encodeURIComponent(`http://${req.headers.host}/callback?s=${secret}`);
	res.writeHead(302, {
		Location: `${session.instance}/authorize_token?scopes=${encodeURIComponent(AUTH_SCOPES)}&callback_url=${callbackUrl}`
	});
	res.end();
}

function handleCodeAttempt(res, req, code) {
	if (isExpired()) {
		return sendPage(res, view.expired, session || lastSession);
	}

	if (code && code.toUpperCase() === session.code) {
		return redirectAuthorize(res, req);
	}

	session.wrongAttempts += 1;
	if (session.wrongAttempts >= MAX_WRONG_CODE_ATTEMPTS) {
		session.code = generateCode();
		session.wrongAttempts = 0;
		channelSend('tv-login:new-code', { code: session.code });
		return sendPage(res, view.form, session, 'tooManyAttempts');
	}

	sendPage(res, view.form, session, 'wrongCode');
}

function handleCallback(res, req, searchParams) {
	const given = Buffer.from(searchParams.get('s') || '');
	const expected = Buffer.from(session ? session.secret : '');
	if (
		isExpired() ||
		session.used ||
		given.length !== expected.length ||
		!crypto.timingSafeEqual(given, expected)
	) {
		return sendPage(res, view.invalid, session || lastSession);
	}

	session.used = true;
	const username = searchParams.get('username') || '';
	const token = searchParams.get('token') || '';

	channelSend('tv-login:success', { username, token });

	sendPage(res, view.done, session);
	stopServer();
}

function handleRequest(req, res) {
	const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
	const path = url.pathname;

	if (path !== '/' && path !== '/go' && path !== '/callback') {
		res.writeHead(404, { 'Content-Type': 'text/plain' });
		return res.end('Not found');
	}

	if (!hostIsOwn(req)) {
		res.writeHead(400, { 'Content-Type': 'text/plain' });
		return res.end('Bad request');
	}

	if (path === '/') {
		if (isExpired()) {
			return sendPage(res, view.expired, session || lastSession);
		}
		const code = url.searchParams.get('c');
		// A code in the URL counts as an attempt, so it can't be brute-forced past the limit.
		if (code) return handleCodeAttempt(res, req, code);
		return sendPage(res, view.form, session);
	}

	if (path === '/go') return handleCodeAttempt(res, req, url.searchParams.get('c'));

	handleCallback(res, req, url.searchParams);
}

let channelRef = null;
function channelSend(eventName, args) {
	if (channelRef) channelRef.send(eventName, args);
}

function stopServer() {
	if (server) {
		server.close();
		server = null;
	}
	lastSession = session || lastSession;
	session = null;
}

module.exports = function startTvLoginServer(channel) {
	channelRef = channel;

	channel.addListener('tv-login:start', (options) => {
		session = {
			code: options.code,
			secret: options.secret,
			instance: options.instance,
			theme: sanitizeTheme(options.theme),
			strings: sanitizeStrings(options.strings),
			lang: typeof options.lang === 'string' && LANG_REGEX.test(options.lang) ? options.lang : 'en',
			expiresAt: Date.now() + SESSION_TTL_MS,
			wrongAttempts: 0,
			used: false
		};

		if (server) return;

		server = http.createServer((req, res) => {
			try {
				handleRequest(req, res);
			} catch (err) {
				res.writeHead(500, { 'Content-Type': 'text/plain' });
				res.end('Error');
			}
		});

		server.on('error', (err) => {
			channelSend('tv-login:error', { message: err.message });
			server = null;
		});

		server.listen(PORT, '0.0.0.0', () => {
			console.log(`TV login server running at http://0.0.0.0:${PORT}`);
		});
	});

	channel.addListener('tv-login:stop', () => stopServer());
};
