const http = require('http');
const https = require('https');
const crypto = require('crypto');

const PORT = 3000;
const MAX_REDIRECTS = 10;
const MAX_REPLAY_BYTES = 2 * 1024 * 1024;
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 12, maxFreeSockets: 4 });
// Native launch configuration may opt in for development; never changed by HTTP requests.
let rejectUnauthorized = process.env.MATERIALIOUS_ALLOW_INSECURE_TLS === 'true' ? false : true;
let proxySessionToken = null;

// TLS exceptions arrive through the Capacitor native bridge, never over HTTP.
try {
	const { channel } = require('bridge');
	channel.on('set-insecure-tls', (isAllowed) => {
		rejectUnauthorized = isAllowed !== true;
	});
	channel.on('set-proxy-session', (token, requestId) => {
		if (typeof token !== 'string' || token.length < 40) return;
		proxySessionToken = token;
		channel.post('proxy-session-ready', requestId);
	});
} catch (err) {
	console.warn('Capacitor bridge unavailable; TLS verification remains enabled.');
}

const CORS_HEADERS = [
	'Origin',
	'X-Requested-With',
	'Content-Type',
	'Accept',
	'Authorization',
	'X-Materialious-Session',
	'x-goog-visitor-id',
	'x-goog-api-key',
	'x-origin',
	'x-youtube-client-version',
	'x-youtube-client-name',
	'x-goog-api-format-version',
	'x-goog-authuser',
	'x-user-agent',
	'Accept-Language',
	'X-Goog-FieldMask',
	'Range',
	'Referer',
	'Cookie',
	'Content-Disposition',
	'__redirect',
	'__custom_return',
	'__sid_auth'
].join(', ');

const CORS_ORIGIN = 'https://www.youtube.com';
const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36(KHTML, like Gecko)';

function setCorsHeaders(res) {
	res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS);
	res.setHeader('Access-Control-Max-Age', '86400');
	res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function proxyRequest(clientReq, clientRes, parsedUrl, body = null, redirectCount = 0) {
	if (redirectCount > MAX_REDIRECTS) {
		clientRes.writeHead(508, { 'Content-Type': 'text/plain' });
		return clientRes.end('Too many redirects');
	}

	const redirectAllowed = clientReq.headers.__redirect !== 'manual';
	const returnHeadersAsJson = clientReq.headers.__custom_return === 'json-headers';

	const isHttps = parsedUrl.protocol === 'https:';
	const httpClient = isHttps ? https : http;

	const proxyOptions = {
		method: clientReq.method,
		headers: {
			...clientReq.headers,
			host: parsedUrl.host,
			origin: parsedUrl.origin,
			'user-agent': USER_AGENT,
			connection: 'keep-alive'
		},
		rejectUnauthorized,
		agent: isHttps ? httpsAgent : undefined
	};

	if (clientReq.headers.__sid_auth) {
		proxyOptions.headers.cookie = clientReq.headers.__sid_auth;
		delete proxyOptions.headers.__sid_auth;
	}
	delete proxyOptions.headers['x-materialious-session'];
	delete proxyOptions.headers.__redirect;
	delete proxyOptions.headers.__custom_return;

	// Remove headers that may cause issues or be auto-managed
	for (const key of [
		'referer',
		'x-forwarded-for',
		'x-requested-with',
		'sec-ch-ua-mobile',
		'sec-ch-ua',
		'sec-ch-ua-platform'
	]) {
		delete proxyOptions.headers[key];
	}

	const proxyReq = httpClient.request(parsedUrl, proxyOptions, (proxyRes) => {
		// Handle redirects normally if redirectAllowed
		if (
			proxyRes.statusCode >= 300 &&
			proxyRes.statusCode < 400 &&
			proxyRes.headers.location &&
			redirectAllowed
		) {
			proxyRes.resume(); // discard response data
			const newUrl = new URL(proxyRes.headers.location, parsedUrl);
			const status = proxyRes.statusCode;
			const rewriteToGet =
				(status === 303 && clientReq.method !== 'HEAD') ||
				((status === 301 || status === 302) && clientReq.method === 'POST');
			if (body === null && clientReq.method !== 'GET' && clientReq.method !== 'HEAD' && !rewriteToGet) {
				clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
				return clientRes.end('Cannot replay streamed request body across redirect');
			}
			if (!rewriteToGet && body && body.length > MAX_REPLAY_BYTES) {
				clientRes.writeHead(413, { 'Content-Type': 'text/plain' });
				return clientRes.end('Redirect body exceeds replay limit');
			}
			if (newUrl.origin !== parsedUrl.origin) {
				for (const key of ['authorization', 'cookie', 'proxy-authorization', '__sid_auth'])
					delete clientReq.headers[key];
			}
			if (rewriteToGet) {
				clientReq.method = 'GET';
				body = Buffer.alloc(0);
				delete clientReq.headers['content-length'];
				delete clientReq.headers['content-type'];
				delete clientReq.headers['transfer-encoding'];
			}
			return proxyRequest(clientReq, clientRes, newUrl, body, redirectCount + 1);
		}

		if (returnHeadersAsJson) {
			proxyRes.resume();
			const headersDict = {};
			for (const [key, value] of Object.entries(proxyRes.headers)) {
				headersDict[key] = value;
			}

			const body = JSON.stringify(headersDict);

			clientRes.writeHead(200, {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': CORS_ORIGIN,
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': CORS_HEADERS,
				'Access-Control-Allow-Credentials': 'true',
				'Content-Length': Buffer.byteLength(body)
			});
			return clientRes.end(body);
		}

		clientRes.writeHead(proxyRes.statusCode, {
			...proxyRes.headers,
			'Access-Control-Allow-Origin': CORS_ORIGIN,
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': CORS_HEADERS,
			'Access-Control-Allow-Credentials': 'true'
		});

		proxyRes.on('error', (err) => proxyReq.destroy(err));
		proxyRes.pipe(clientRes);
	});

	// Timeout handler
	proxyReq.setTimeout(clientReq.headers.range ? 0 : 30000, () => {
		proxyReq.destroy(new Error('Proxy request timed out'));
	});

	proxyReq.on('error', (err) => {
		console.error('Proxy request error:', err.message);
		if (clientRes.headersSent) return clientRes.destroy(err);
		if (!clientRes.headersSent) {
			clientRes.writeHead(500, { 'Content-Type': 'text/plain' });
		}
		clientRes.end(`Proxy error: ${err.message}`);
	});

	clientReq.on('aborted', () => proxyReq.destroy());
	clientRes.on('close', () => {
		if (!clientRes.writableEnded) proxyReq.destroy();
	});
	if (body !== null) {
		if (body.length) proxyReq.write(body);
		proxyReq.end();
	} else if (redirectCount > 0) {
		proxyReq.end();
	} else {
		clientReq.pipe(proxyReq);
	}
}

const server = http.createServer((req, res) => {
	setCorsHeaders(res);

	if (req.method === 'OPTIONS') {
		res.writeHead(204);
		return res.end();
	}
	if (req.method === 'GET' && req.url === '/check-nodejs') {
		res.writeHead(200);
		return res.end();
	}

	const suppliedToken = req.headers['x-materialious-session'];
	const suppliedTokenBuffer =
		typeof suppliedToken === 'string' ? Buffer.from(suppliedToken) : Buffer.alloc(0);
	const expectedTokenBuffer = proxySessionToken ? Buffer.from(proxySessionToken) : Buffer.alloc(0);
	if (
		!proxySessionToken ||
		suppliedTokenBuffer.length !== expectedTokenBuffer.length ||
		!crypto.timingSafeEqual(suppliedTokenBuffer, expectedTokenBuffer)
	) {
		res.writeHead(401, { 'Content-Type': 'text/plain' });
		return res.end('Unauthorized Materialious session');
	}

	if (!req.url || req.url === '/') {
		res.writeHead(400, { 'Content-Type': 'text/plain' });
		return res.end('No URL provided.');
	}

	let targetUrl = req.url.slice(1);

	if (!targetUrl.startsWith('http')) {
		targetUrl = 'http://' + targetUrl;
	}

	let parsedTarget;
	try {
		parsedTarget = new URL(targetUrl);
	} catch (err) {
		res.writeHead(400, { 'Content-Type': 'text/plain' });
		return res.end(`Invalid URL: ${err.message}`);
	}

	proxyRequest(req, res, parsedTarget);
});

server.listen(PORT, '127.0.0.1', () => {
	console.log(`Proxy server running at http://127.0.0.1:${PORT}`);
});

process.on('SIGINT', () => {
	httpsAgent.destroy();
	server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
	httpsAgent.destroy();
	server.close(() => process.exit(0));
});
