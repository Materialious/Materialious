const http = require('http');
const https = require('https');

const HOST = 'localhost';
const PORT = 3000;
const MAX_REDIRECTS = 5;
const ORIGIN = `https://${HOST}`;

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function fetchWithRedirects(targetUrl, options, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        const httpClient = targetUrl.protocol.startsWith('https') ? https : http;

        const req = httpClient.request(targetUrl, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                if (redirectCount >= MAX_REDIRECTS) {
                    return reject(new Error('Too many redirects'));
                }

                let redirectHeaderLocation = res.headers.location;

                // Handle relative URLs
                if (redirectHeaderLocation.startsWith('/')) {
                    redirectHeaderLocation = targetUrl.host + redirectHeaderLocation;
                }

                // Add http:// if missing from the Location header
                if (!redirectHeaderLocation.startsWith('http')) {
                    redirectHeaderLocation = 'http://' + redirectHeaderLocation;
                }

                try {
                    // Attempt to create the redirect URL
                    let redirectUrl = new URL(redirectHeaderLocation);
                    return resolve(fetchWithRedirects(redirectUrl, options, redirectCount + 1));
                } catch (error) {
                    // Catch invalid URL errors
                    return reject(new Error(`Invalid URL in redirect: ${error.message}`));
                }
            }
            resolve(res); // Resolve with the final response if not a redirect
        });

        req.on('error', reject);
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

    const targetUrl = req.url.slice(1); // Remove leading '/'
    let parsedTarget;
    try {
        if (!targetUrl.startsWith('http')) {
            targetUrl = 'http://' + targetUrl;
        }
        parsedTarget = new URL(targetUrl);
    } catch (error) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end(`Invalid URL: ${error.message}`);
    }

    const options = {
        method: req.method,
        headers: {
            ...req.headers,
            host: parsedTarget.hostname, // Ensure correct host header
        },
    };

    try {
        const proxyRes = await fetchWithRedirects(parsedTarget, options);
        res.writeHead(proxyRes.statusCode, {
            ...proxyRes.headers,
            'Access-Control-Allow-Origin': ORIGIN,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Credentials': 'true',
        });

        proxyRes.pipe(res); // Pipe response data back to the client
    } catch (error) {
        console.error('Proxy error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error: ${error.message}`);
    }
});

server.listen(PORT, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});
