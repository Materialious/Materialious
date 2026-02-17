import { resolve } from '$app/paths';
import { invidiousAuthStore } from '$lib/store';
import { redirect } from '@sveltejs/kit';

export async function load({ url }) {
	const username = url.searchParams.get('username');
	const token = url.searchParams.get('token');

	if (username && token) {
		invidiousAuthStore.set({
			username: username,
			token: token
		});
	}

	throw redirect(302, resolve('/', {}));
}
