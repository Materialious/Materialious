import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_CONNECTION_URI: { schema: (input) => input ?? '' },
	COOKIE_SECRET: { schema: (input) => input ?? '' },
	RATE_LIMIT_DISABLED: { schema: (input) => input ?? '' },
	PUBLIC_RATE_LIMIT_DISABLED: { schema: (input) => input ?? '' },
	HISTORY_CULLING: { schema: (input) => input ?? '' },
	PUBLIC_DEFAULT_DEARROW_THUMBNAIL_INSTANCE: { public: true, schema: (input) => input ?? '' },
	PUBLIC_DEFAULT_DEARROW_INSTANCE: { public: true, schema: (input) => input ?? '' },
	PUBLIC_DEFAULT_INVIDIOUS_INSTANCE: { public: true, schema: (input) => input ?? '' },
	PUBLIC_DEFAULT_RETURNYTDISLIKES_INSTANCE: { public: true, schema: (input) => input ?? '' },
	PUBLIC_DEFAULT_API_EXTENDED_INSTANCE: { public: true, schema: (input) => input ?? '' },
	PUBLIC_DEFAULT_COMPANION_INSTANCE: { public: true, schema: (input) => input ?? '' },
	PUBLIC_DEFAULT_SETTINGS: { public: true, schema: (input) => input ?? '' },
	PUBLIC_DEFAULT_SPONSERBLOCK_INSTANCE: { public: true, schema: (input) => input ?? '' },
	PUBLIC_PLAYER_ID: { public: true, schema: (input) => input ?? '' },
	PUBLIC_PROXY_DISABLED: { public: true, schema: (input) => input ?? '' },
	WHITELIST_BASE_DOMAIN: { schema: (input) => input ?? '' },
	PROXY_TRUST_CA: { schema: (input) => input ?? '' },
	PUBLIC_BUILD_WITH_BACKEND: { public: true, schema: (input) => input ?? '' },
	PUBLIC_INTERNAL_AUTH: { public: true, schema: (input) => input ?? '' },
	PUBLIC_REQUIRE_AUTH: { public: true, schema: (input) => input ?? '' },
	PUBLIC_REGISTRATION_ALLOWED: { public: true, schema: (input) => input ?? '' },
	PUBLIC_DANGEROUS_ALLOW_ANY_PROXY: { public: true, schema: (input) => input ?? '' },
	PUBLIC_CAPTCHA_DISABLED: { public: true, schema: (input) => input ?? '' },
	PUBLIC_QUICK_CONNECT: { public: true, schema: (input) => input ?? '' },
	PUBLIC_ADMIN_USERNAMES: { public: true, schema: (input) => input ?? '' }
});
