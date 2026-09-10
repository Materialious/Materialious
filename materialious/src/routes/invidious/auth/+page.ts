import { resolve } from '$app/paths';
import { addOrUpdateKeyValue } from '$lib/api/backend/keyvalue.js';
import { isMaterialiousAccountActive } from '$lib/misc';
import { invidiousAuthStore } from '$lib/store';
import { redirect } from '@sveltejs/kit';

export async function load({ url }) {
	const username = url.searchParams.get('username');
	const token = url.searchParams.get('token');

	if (username && token) {
		const authToken = {
			username: username,
			token: token
		};
		invidiousAuthStore.set(authToken);
		if (isMaterialiousAccountActive()) {
			await addOrUpdateKeyValue('authToken', JSON.stringify(authToken));
		}
	}

	throw redirect(302, resolve('/', {}));
}
