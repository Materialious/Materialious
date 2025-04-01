const http = require('http');
const https = require('https');

const HOST = 'localhost';
const PORT = 3000;
const MAX_REDIRECTS = 10;

const CORS_HEADERS = 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-goog-visitor-id, x-goog-api-key, x-origin, x-youtube-client-version, x-youtube-client-name, x-goog-api-format-version, x-user-agent, Accept-Language, Range, Referer'
const CORS_ORIGIN = 'https://localhost'
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36(KHTML, like Gecko)'

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS);
    res.setHeader('Access-Control-Max-Age', '86400')
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function fetchWithRedirects(targetUrl, options, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        const httpClient = targetUrl.protocol.startsWith('https') ? https : http;

        const req = httpClient.request(targetUrl, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                if (redirectCount >= MAX_REDIRECTS) {
                    req.end();
                    return reject(new Error('Too many redirects'));
                }

                try {
                    // Attempt to create the redirect URL
                    const redirectUrl = new URL(res.headers.location, targetUrl);
                    return resolve(fetchWithRedirects(redirectUrl, options, redirectCount + 1));
                } catch (error) {
                    req.end();
                    return reject(new Error(`Invalid URL in redirect: ${error.message}`));
                }
            }
            resolve(res); // Resolve with the final response if not a redirect
        });

        if (options.body && (req.method === 'POST' || req.method === 'PUT')) {
            req.write(options.body);
        }

        req.setTimeout(10000, () => reject(new Error('Request timeout')), req.end());
        req.on('error', (error) => reject(error), req.end());
        req.end();
    });
}

const server = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end();
    }

    if (!req.url || req.url === '/') {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('No URL provided to fetch.');
    }

    let targetUrl = req.url.slice(1); // Remove leading '/'
    let parsedTarget;
    try {
        // Ensure protocol (http) is added if missing
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'http://' + targetUrl;
        }
        parsedTarget = new URL(targetUrl);
    } catch (error) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end(`Invalid URL: ${error.message}`);
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk;
    });

    req.on('end', async () => {
        const options = {
            method: req.method,
            headers: Object.fromEntries(
                Object.entries(req.headers).filter(([key]) => ![
                    'host', 'origin', 'referer', 'x-forwarded-for', 'x-requested-with'
                ].includes(key.toLowerCase()))
            )
        };

        options.headers.host = parsedTarget.host;
        options.headers.origin = parsedTarget.origin;
        options.headers['user-agent'] = USER_AGENT;

        // For POST and PUT methods, pass the body to the outgoing request
        if (req.method === 'POST' || req.method === 'PUT') {
            options.headers['Content-Length'] = Buffer.byteLength(body);
            options.body = body;
        }

        try {
            const proxyRes = await fetchWithRedirects(parsedTarget, options);

            req.on('close', () => {
                console.log('Request canceled by the client.');
                proxyRes.destroy();
            });

            res.writeHead(proxyRes.statusCode, {
                ...proxyRes.headers,
                'Access-Control-Allow-Origin': CORS_ORIGIN,
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': CORS_HEADERS,
                'Access-Control-Allow-Credentials': 'true',
            });

            // Pipe response data back to the client
            proxyRes.pipe(res);

        } catch (error) {
            console.error('Proxy error:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Error: ${error.message}`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});
