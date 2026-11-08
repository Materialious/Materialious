const http = require('http');
const os = require('os');
const crypto = require('crypto');

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

function page(title, body) {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
	body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
	input { font-size: 1.25rem; letter-spacing: 0.2em; text-transform: uppercase; width: 10ch; padding: 0.5rem; }
	button { font-size: 1.1rem; padding: 0.5rem 1.5rem; }
	.error { color: #b3261e; font-weight: bold; }
</style>
</head>
<body>
<h1>${title}</h1>
${body}
</body>
</html>`;
}

function codeForm(message = '', isError = false) {
	const messageHtml = message
		? `<p class="${isError ? 'error' : ''}" role="alert">${message}</p>`
		: '';
	return page(
		'Login to Materialious',
		`${messageHtml}
<p>Enter the code shown on your TV:</p>
<form method="GET" action="/go">
	<label for="code">Code</label><br>
	<input id="code" name="c" autocomplete="off" maxlength="6" required>
	<br><br>
	<button type="submit">Continue</button>
</form>`
	);
}

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
		res.writeHead(410, { 'Content-Type': 'text/html' });
		return res.end(
			page('Login expired', '<p>The login request expired. Start it again on your TV.</p>')
		);
	}

	if (code && code.toUpperCase() === session.code) {
		return redirectAuthorize(res, req);
	}

	session.wrongAttempts += 1;
	if (session.wrongAttempts >= MAX_WRONG_CODE_ATTEMPTS) {
		session.code = generateCode();
		session.wrongAttempts = 0;
		channelSend('tv-login:new-code', { code: session.code });
		res.writeHead(200, { 'Content-Type': 'text/html' });
		return res.end(
			codeForm('Too many wrong attempts. A new code was generated — check your TV.', true)
		);
	}

	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.end(codeForm('Wrong code. Try again.', true));
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
		res.writeHead(403, { 'Content-Type': 'text/html' });
		return res.end(
			page('Login failed', '<p>This login link is no longer valid. Start it again on your TV.</p>')
		);
	}

	session.used = true;
	const username = searchParams.get('username') || '';
	const token = searchParams.get('token') || '';

	channelSend('tv-login:success', { username, token });

	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.end(
		page(
			'Logged in',
			'<p><strong>Done!</strong> Your TV is now logged in. You can close this page.</p>'
		)
	);
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
			res.writeHead(410, { 'Content-Type': 'text/html' });
			return res.end(
				page('Login expired', '<p>The login request expired. Start it again on your TV.</p>')
			);
		}
		const code = url.searchParams.get('c');
		// A code in the URL counts as an attempt, so it can't be brute-forced past the limit.
		if (code) return handleCodeAttempt(res, req, code);
		res.writeHead(200, { 'Content-Type': 'text/html' });
		return res.end(codeForm());
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
	session = null;
}

module.exports = function startTvLoginServer(channel) {
	channelRef = channel;

	channel.addListener('tv-login:start', (options) => {
		session = {
			code: options.code,
			secret: options.secret,
			instance: options.instance,
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
