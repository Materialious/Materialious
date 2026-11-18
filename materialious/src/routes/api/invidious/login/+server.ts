import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { loginInvidious } from '@materialious/shared/invidious';
import { isOwnBackend } from '#lib/shared';
import {
	PUBLIC_DEFAULT_INVIDIOUS_INSTANCE,
	PUBLIC_PROXY_DISABLED,
	PUBLIC_REQUIRE_BROWSER_COMPANION
} from '$app/env/public';
import { WHITELIST_BASE_DOMAIN } from '$app/env/private';
import { parse as tldParse } from 'tldts';

const credentialsSchema = z.object({
	instance: z.url().max(2048),
	username: z.string().trim().min(1).max(320),
	password: z.string().min(1).max(4096)
});

export async function POST({ request, locals }) {
	const backend = isOwnBackend();
	if (!backend || PUBLIC_PROXY_DISABLED === 'true' || PUBLIC_REQUIRE_BROWSER_COMPANION === 'true') {
		throw error(404, 'Password login unavailable');
	}
	if (backend.requireAuth && !locals.userId) throw error(401, 'Auth required');

	const credentials = credentialsSchema.safeParse(await request.json().catch(() => null));
	if (!credentials.success) throw error(400, 'Invalid login request');
	const instance = new URL(credentials.data.instance);
	if (!['http:', 'https:'].includes(instance.protocol) || instance.username || instance.password) {
		throw error(400, 'Invalid instance');
	}
	const configuredHost = PUBLIC_DEFAULT_INVIDIOUS_INSTANCE
		? new URL(PUBLIC_DEFAULT_INVIDIOUS_INSTANCE).host
		: undefined;
	const domain = tldParse(instance.hostname).domain;
	const whitelisted = !!domain && (WHITELIST_BASE_DOMAIN || '').split(',').includes(domain);
	const allowAny =
		backend.allowAnyProxy && backend.requireAuth && !backend.registrationAllowed && !!locals.userId;
	if (instance.host !== configuredHost && !whitelisted && !allowAny) {
		throw error(400, 'Instance not whitelisted');
	}

	const result = await loginInvidious(credentials.data);
	return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
