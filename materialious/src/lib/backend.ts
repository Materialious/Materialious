import sodium from 'libsodium-wrappers-sumo';

export type IsOwnBackend = {
	builtWithBackend: boolean;
	internalAuth: boolean;
	requireAuth: boolean;
	registrationAllowed: boolean;
};

export function isOwnBackend(): IsOwnBackend | null {
	if (import.meta.env.VITE_BUILD_WITH_BACKEND !== 'true') return null;

	return {
		builtWithBackend: true,
		internalAuth: import.meta.env.VITE_INTERNAL_AUTH !== 'false',
		requireAuth: import.meta.env.VITE_REQUIRE_AUTH !== 'false',
		registrationAllowed: import.meta.env.VITE_REGISTRATION_ALLOWED === 'true'
	};
}

export async function backendLogin(username: string, rawPassword: string) {
	await sodium.ready;

	const passwordSaltsResp = await fetch(`/api/user/${username}/public`);
	if (!passwordSaltsResp.ok) return;

	const passwordSalts = await passwordSaltsResp.json();

	const loginHash = sodium.crypto_pwhash(
		32,
		rawPassword,
		sodium.from_base64(passwordSalts.passwordSalt),
		sodium.crypto_pwhash_OPSLIMIT_SENSITIVE,
		sodium.crypto_pwhash_MEMLIMIT_SENSITIVE,
		sodium.crypto_pwhash_ALG_DEFAULT
	);

	const loginResp = await fetch('/api/user/login', {
		method: 'POST',
		body: JSON.stringify({
			username,
			passwordHash: loginHash
		})
	});

	if (!loginResp.ok) return;

	const subscriptionRawKey = sodium.crypto_pwhash(
		32,
		rawPassword,
		sodium.from_base64(passwordSalts.subscriptionPasswordSalt),
		sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_ALG_DEFAULT
	);
}
