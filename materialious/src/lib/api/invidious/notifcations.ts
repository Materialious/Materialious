import { buildAuthHeaders, buildPath, fetchErrorHandle } from './request';

export async function notificationsMarkAsReadInvidious(fetchOptions: RequestInit = {}) {
	const path = buildPath('auth/notifications');
	await fetchErrorHandle(await fetch(path, { ...buildAuthHeaders(), ...fetchOptions }));
}
