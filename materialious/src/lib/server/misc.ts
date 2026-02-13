import type { Cookies } from '@sveltejs/kit';
import { sign } from 'cookie-signature';
import { env } from '$env/dynamic/private';

export function setAuthCookie(id: string, cookies: Cookies) {
	cookies.set('userid', sign(id, env.COOKIE_SECRET), {
		httpOnly: true,
		path: '/api/user',
		maxAge: 60 * 60 * 24 * 60 // 60 days
	});
}
