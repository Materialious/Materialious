const http = require('http');
const https = require('https');

const HOST = 'localhost';
const PORT = 3000;
const MAX_REDIRECTS = 10;

// Can be changed via channels to disable ssl validation.
let rejectUnauthorized = true;

const CORS_HEADERS = [
	'Origin',
	'X-Requested-With',
	'Content-Type',
	'Accept',
	'Authorization',
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
	'Cookie'
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

function proxyRequest(clientReq, clientRes, parsedUrl, bodyChunks = [], redirectCount = 0) {
	if (redirectCount > MAX_REDIRECTS) {
		clientRes.writeHead(508, { 'Content-Type': 'text/plain' });
		return clientRes.end('Too many redirects');
	}

	const isHttps = parsedUrl.protocol === 'https:';
	const httpClient = isHttps ? https : http;

	const proxyOptions = {
		method: clientReq.method,
		headers: {
			...clientReq.headers,
			host: parsedUrl.host,
			origin: parsedUrl.origin,
			'user-agent': USER_AGENT,
			connection: 'close'
		},
		rejectUnauthorized: rejectUnauthorized
	};

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
		// Handle redirects
		if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
			proxyRes.resume(); // discard response data
			const newUrl = new URL(proxyRes.headers.location, parsedUrl);
			return proxyRequest(clientReq, clientRes, newUrl, bodyChunks, redirectCount + 1);
		}

		clientRes.writeHead(proxyRes.statusCode, {
			...proxyRes.headers,
			'Access-Control-Allow-Origin': CORS_ORIGIN,
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': CORS_HEADERS,
			'Access-Control-Allow-Credentials': 'true'
		});

		proxyRes.pipe(clientRes);
	});

	// Timeout handler
	proxyReq.setTimeout(120000, () => {
		proxyReq.destroy(new Error('Proxy request timed out'));
	});

	proxyReq.on('error', (err) => {
		console.error('Proxy request error:', err.message);
		if (!clientRes.headersSent) {
			clientRes.writeHead(500, { 'Content-Type': 'text/plain' });
		}
		clientRes.end(
			`Proxy error: ${err.message} ${rejectUnauthorized} rejectUnauthorized ${typeof rejectUnauthorized}`
		);
	});

	clientReq.on('aborted', () => proxyReq.destroy());

	// Write buffered body if present
	if (bodyChunks.length > 0) {
		proxyReq.write(Buffer.concat(bodyChunks));
	}

	proxyReq.end();
}

const server = http.createServer((req, res) => {
	setCorsHeaders(res);

	if (req.method === 'OPTIONS') {
		res.writeHead(204);
		return res.end();
	}

	if (!req.url || req.url === '/') {
		res.writeHead(400, { 'Content-Type': 'text/plain' });
		return res.end('No URL provided.');
	}

	let targetUrl = req.url.slice(1);

	// Quick way to quickly send commands between app and nodejs backend.
	if (targetUrl === 'http://materialious__allow-insecure-requests') {
		rejectUnauthorized = false;
		res.writeHead(204);
		return res.end();
	} else if (targetUrl === 'http://materialious__deny-insecure-requests') {
		rejectUnauthorized = true;
		res.writeHead(204);
		return res.end();
	}

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

	const bodyChunks = [];
	req.on('data', (chunk) => bodyChunks.push(chunk));
	req.on('end', () => proxyRequest(req, res, parsedTarget, bodyChunks));
});

server.listen(PORT, () => {
	console.log(`Proxy server running at http://${HOST}:${PORT}`);
});
