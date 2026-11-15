// Invidious returns 403 for authentication failures, scope errors, and even
// some downstream failures. Only these specific errors establish that the
// current credential can no longer authenticate with this instance.
export function isRejectedInvidiousSession(status: number, apiError: unknown): boolean {
	return (
		status === 403 &&
		(apiError === 'Request must be authenticated' ||
			apiError === 'Token is expired, please try again' ||
			apiError === 'Invalid signature')
	);
}
