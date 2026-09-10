import type { Cookies } from '@sveltejs/kit';
import { sign } from 'cookie-signature';
import { env } from '$env/dynamic/private';

export function generateAuthToken(id: string): string {
	return sign(id, env.COOKIE_SECRET as string);
}

export function setAuthCookie(id: string, cookies: Cookies) {
	cookies.set('userid', generateAuthToken(id), {
		httpOnly: true,
		path: '/api',
		maxAge: 60 * 60 * 24 * 60 // 60 days
	});
}
