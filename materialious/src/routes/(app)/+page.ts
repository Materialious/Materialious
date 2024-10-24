import { getPopular } from '$lib/api/index.js';
import { error } from '@sveltejs/kit';

export async function load() {
	let popular = undefined;
	let popularDisabled: boolean = false;

	try {
		popular = await getPopular();
	} catch (errorMessage: any) {
		if (errorMessage.toString() === 'Error: Administrator has disabled this endpoint.') {
			popularDisabled = true;
		} else {
			error(500, errorMessage);
		}
	}
	return {
		popular: popular,
		popularDisabled: popularDisabled
	};
}
