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
