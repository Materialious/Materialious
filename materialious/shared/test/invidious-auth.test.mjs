import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { loginInvidious } from '../dist/invidious/auth.js';

const credentials = { instance: 'https://iv.example', username: 'User', password: 'a&b=secret' };

test('cookie login captures all cookies without following redirects and verifies SID', async () => {
	const requests = [];
	const server = createServer(async (req, res) => {
		requests.push(req.url);
		if (req.url === '/prefix/login?type=invidious') {
			assert.equal(req.method, 'POST');
			assert.equal(req.headers['content-type'], 'application/x-www-form-urlencoded');
			let body = '';
			for await (const chunk of req) body += chunk;
			const form = new URLSearchParams(body);
			assert.equal(form.get('email'), 'User');
			assert.equal(form.get('password'), credentials.password);
			res.writeHead(302, {
				'Set-Cookie': [
					'PREFS=test; Path=/',
					'SID=test-session; Expires=Wed, 01 Jan 2031 00:00:00 GMT; HttpOnly'
				],
				Location: '/do-not-follow'
			});
			res.end();
		} else if (req.url === '/prefix/api/v1/auth/subscriptions') {
			assert.equal(req.headers.cookie, 'SID=test-session');
			assert.equal(req.headers.authorization, undefined);
			assert.equal(req.headers.__sid_auth, undefined);
			assert.equal(req.headers.__redirect, undefined);
			res.setHeader('Content-Type', 'application/json');
			res.end('[]');
		} else {
			res.writeHead(500).end();
		}
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	try {
		const instance = `http://127.0.0.1:${server.address().port}/prefix`;
		const result = await loginInvidious({ ...credentials, instance });
		assert.deepEqual(result, {
			ok: true,
			session: { username: 'user', token: 'SID=test-session', instance }
		});
		assert.deepEqual(requests, [
			'/prefix/login?type=invidious',
			'/prefix/api/v1/auth/subscriptions'
		]);
		assert.equal(JSON.stringify(result).includes(credentials.password), false);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
});

for (const [name, response, expected] of [
	['bad password', { status: 401, cookies: [] }, 'credentials'],
	['challenge HTML with status 200', { status: 200, cookies: [] }, 'challenge'],
	['unavailable login route', { status: 404, cookies: [] }, 'instance']
]) {
	test(name, async () => {
		assert.deepEqual(await loginInvidious(credentials, async () => response), {
			ok: false,
			error: expected
		});
	});
}

test('a SID is not saved when authenticated verification fails', async () => {
	let count = 0;
	const result = await loginInvidious(credentials, async () =>
		++count === 1 ? { status: 302, cookies: ['SID=invalid'] } : { status: 403, cookies: [] }
	);
	assert.deepEqual(result, { ok: false, error: 'credentials' });
});

test('successful HTML from an intercepting proxy is not authenticated JSON', async () => {
	let count = 0;
	const result = await loginInvidious(credentials, async () =>
		++count === 1
			? { status: 302, cookies: ['SID=test'] }
			: { status: 200, cookies: [], data: '<html>Login</html>' }
	);
	assert.deepEqual(result, { ok: false, error: 'credentials' });
});

test('network exceptions return a safe result without credentials', async () => {
	assert.deepEqual(
		await loginInvidious(credentials, async () => {
			throw new Error('offline');
		}),
		{
			ok: false,
			error: 'network'
		}
	);
});

test('unsupported protocols and URL credentials never reach transport', async () => {
	for (const instance of ['file:///etc/passwd', 'https://user:password@iv.example']) {
		assert.deepEqual(
			await loginInvidious({ ...credentials, instance }, () => {
				assert.fail('transport must not run');
			}),
			{ ok: false, error: 'instance' }
		);
	}
});
