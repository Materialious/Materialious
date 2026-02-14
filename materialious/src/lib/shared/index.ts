import { env } from '$env/dynamic/public';

export type IsOwnBackend = {
	builtWithBackend: boolean;
	internalAuth: boolean;
	requireAuth: boolean;
	registrationAllowed: boolean;
	allowAnyProxy: boolean;
};

export function isOwnBackend(): IsOwnBackend | null {
	if (env.PUBLIC_BUILD_WITH_BACKEND !== 'true') return null;

	return {
		builtWithBackend: true,
		internalAuth: env.PUBLIC_INTERNAL_AUTH !== 'false',
		requireAuth: env.PUBLIC_REQUIRE_AUTH !== 'false',
		registrationAllowed: env.PUBLIC_REGISTRATION_ALLOWED === 'true',
		allowAnyProxy: env.PUBLIC_DANGEROUS_ALLOW_ANY_PROXY === 'true'
	};
}
