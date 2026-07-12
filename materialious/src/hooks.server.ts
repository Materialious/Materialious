import { isOwnBackend } from '$lib/shared';
import { getSequelize } from '$lib/server/database';
import { unsign } from 'cookie-signature';
import { env } from '$env/dynamic/private';
import { RateLimiter } from 'sveltekit-rate-limiter/server';
import sodium from 'libsodium-wrappers-sumo';

let captchaKey = '';
let captchaSignature = '';
sodium.ready.then(() => {
	captchaKey = sodium.to_base64(sodium.randombytes_buf(32));
	captchaSignature = sodium.to_base64(sodium.randombytes_buf(32));
});

let sequelizeAuthenticated = false;

const limiter = new RateLimiter({
	IP: [240, 'm']
});

const strictLimiter = new RateLimiter({
	IP: [5, 'm']
});

const sensitivePaths = [/^\/api\/user\/create$/, /^\/api\/user\/login$/];

function getLimiter(pathname: string): RateLimiter {
	if (sensitivePaths.some((p) => p.test(pathname))) {
		return strictLimiter;
	}
	return limiter;
}

export async function handle({ event, resolve }) {
	if (!isOwnBackend()?.internalAuth) {
		return await resolve(event);
	}

	event.locals.captchaKey = captchaKey;
	event.locals.captchaSignature = captchaSignature;

	const sequelize = getSequelize();
	if (!sequelizeAuthenticated) {
		await sequelize.sequelize.sync();
		await sequelize.sequelize.authenticate();
		sequelizeAuthenticated = true;
	}

	if (!env.COOKIE_SECRET) {
		throw new Error('Cookie secret must be set');
	}

	if (env.COOKIE_SECRET.length < 16) {
		throw new Error('COOKIE_SECRET must be at least 16 characters long');
	}

	const signedUserId = event.cookies.get('userid');
	if (signedUserId) {
		const userId = unsign(signedUserId, env.COOKIE_SECRET);
		if (userId) {
			event.locals.userId = userId;
		}
	}

	if (!env.PUBLIC_RATE_LIMIT_DISABLED) {
		if (event.url.pathname.startsWith('/api/')) {
			const limiter = getLimiter(event.url.pathname);
			if (await limiter.isLimited(event)) {
				return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
					status: 429,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}
	}

	return await resolve(event);
}
