import { isOwnBackend } from '#lib/shared/index';
import { getSequelize } from '#lib/server/database';
import { runSequelizeMigrations } from '#lib/server/migrations';
import { unsign } from 'cookie-signature';

import {
	DATABASE_CONNECTION_URI,
	COOKIE_SECRET,
	RATE_LIMIT_DISABLED,
	PUBLIC_RATE_LIMIT_DISABLED
} from '$app/env/private';

import { RateLimiter } from 'sveltekit-rate-limiter/server';
import sodium from 'libsodium-wrappers-sumo';

let captchaKey = '';
let captchaSignature = '';
sodium.ready.then(() => {
	captchaKey = sodium.to_base64(sodium.randombytes_buf(32));
	captchaSignature = sodium.to_base64(sodium.randombytes_buf(32));
});

let sequelizeAuthenticated = false;

const strictLimiter = new RateLimiter({
	IP: [10, 'm']
});

const quickConnectLimiter = new RateLimiter({
	IP: [120, 'm']
});

const sensitiveRoutes = new Set([
	'/api/user/delete',
	'/api/user/2fa',
	'/api/user/2fa/verify',
	'/api/user/create',
	'/api/user/login',
	'/api/invidious/login'
]);

export async function handle({ event, resolve }) {
	if (!isOwnBackend()?.internalAuth) {
		return await resolve(event);
	}

	event.locals.captchaKey = captchaKey;
	event.locals.captchaSignature = captchaSignature;

	if (DATABASE_CONNECTION_URI) {
		const sequelize = getSequelize();
		if (!sequelizeAuthenticated) {
			await sequelize.sequelize.sync();
			await sequelize.sequelize.authenticate();
			await runSequelizeMigrations(sequelize.sequelize);
			sequelizeAuthenticated = true;
		}

		if (!COOKIE_SECRET) {
			throw new Error('Cookie secret must be set');
		}

		if (COOKIE_SECRET.length < 16) {
			throw new Error('COOKIE_SECRET must be at least 16 characters long');
		}

		const signedUserId = event.cookies.get('userid');
		if (signedUserId) {
			const userId = unsign(signedUserId, COOKIE_SECRET);
			if (userId) {
				event.locals.userId = userId;
			}
		}

		const authorization = event.request.headers.get('authorization');
		if (!event.locals.userId && authorization?.startsWith('Bearer ')) {
			const token = authorization.slice(7);
			const userId = unsign(token, COOKIE_SECRET);
			if (userId) {
				event.locals.userId = userId;
			}
		}
	}

	if (!RATE_LIMIT_DISABLED && !PUBLIC_RATE_LIMIT_DISABLED) {
		const tooManyRequests = () =>
			new Response(JSON.stringify({ error: 'Too Many Requests' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json' }
			});

		// Match the resolved route so percent-encoded URLs cannot bypass limits.
		const routeId = event.route.id ?? '';
		if (sensitiveRoutes.has(routeId)) {
			if (await strictLimiter.isLimited(event)) {
				return tooManyRequests();
			}
		}

		if (routeId === '/api/user/quickConnect' || routeId.startsWith('/api/user/quickConnect/')) {
			if (await quickConnectLimiter.isLimited(event)) {
				return tooManyRequests();
			}
		}
	}

	return await resolve(event);
}
