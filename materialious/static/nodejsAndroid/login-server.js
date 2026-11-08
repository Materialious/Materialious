const http = require('http');
const os = require('os');
const crypto = require('crypto');

const pages = require('./login-pages');

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

const SECURITY_HEADERS = {
	'Content-Type': 'text/html; charset=utf-8',
	'Content-Security-Policy':
		"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
	'Cache-Control': 'no-store',
	'Referrer-Policy': 'no-referrer',
	'X-Content-Type-Options': 'nosniff'
};

function sendHtml(res, status, html) {
	res.writeHead(status, SECURITY_HEADERS);
	res.end(html);
}

function redirectAuthorize(res, req) {
	const secret = encodeURIComponent(session.secret);
	const callbackUrl = encodeURIComponent(`http://${req.headers.host}/callback?s=${secret}`);
	const target = `${session.instance}/authorize_token?scopes=${encodeURIComponent(AUTH_SCOPES)}&callback_url=${callbackUrl}`;
	sendHtml(res, 200, pages.redirecting(session, target));
}

function handleCodeAttempt(res, req, code) {
	if (isExpired()) {
		return sendHtml(res, 410, pages.expired(session || lastSession));
	}

	if (code && code.toUpperCase() === session.code) {
		return redirectAuthorize(res, req);
	}

	session.wrongAttempts += 1;
	if (session.wrongAttempts >= MAX_WRONG_CODE_ATTEMPTS) {
		session.code = generateCode();
		session.wrongAttempts = 0;
		channelSend('tv-login:new-code', { code: session.code });
		return sendHtml(res, 200, pages.codeForm(session, 'tooManyAttempts'));
	}

	sendHtml(res, 200, pages.codeForm(session, 'wrongCode'));
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
		return sendHtml(res, 403, pages.invalid(session || lastSession));
	}

	session.used = true;
	const username = searchParams.get('username') || '';
	const token = searchParams.get('token') || '';

	channelSend('tv-login:success', { username, token });

	sendHtml(res, 200, pages.done(session));
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
			return sendHtml(res, 410, pages.expired(session || lastSession));
		}
		const code = url.searchParams.get('c');
		// A code in the URL counts as an attempt, so it can't be brute-forced past the limit.
		if (code) return handleCodeAttempt(res, req, code);
		return sendHtml(res, 200, pages.codeForm(session));
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
			theme: pages.sanitizeTheme(options.theme),
			strings: pages.sanitizeStrings(options.strings),
			lang: pages.sanitizeLang(options.lang),
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
