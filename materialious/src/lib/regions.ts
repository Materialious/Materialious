/**
 * Regions that YouTube accepts as content regions.
 *
 * This mirrors the list Invidious uses for its own `region` preference:
 * https://github.com/iv-org/invidious/blob/master/config/config.example.yml
 *
 * ISO 3166-1 contains many more countries than YouTube supports. Sending an
 * unsupported region to Invidious can make region-scoped endpoints (such as
 * search and hashtags) fail or return no results.
 */
export const contentRegions = [
	'AE',
	'AR',
	'AT',
	'AU',
	'AZ',
	'BA',
	'BD',
	'BE',
	'BG',
	'BH',
	'BO',
	'BR',
	'BY',
	'CA',
	'CH',
	'CL',
	'CO',
	'CR',
	'CY',
	'CZ',
	'DE',
	'DK',
	'DO',
	'DZ',
	'EC',
	'EE',
	'EG',
	'ES',
	'FI',
	'FR',
	'GB',
	'GE',
	'GH',
	'GR',
	'GT',
	'HK',
	'HN',
	'HR',
	'HU',
	'ID',
	'IE',
	'IL',
	'IN',
	'IQ',
	'IS',
	'IT',
	'JM',
	'JO',
	'JP',
	'KE',
	'KR',
	'KW',
	'KZ',
	'LB',
	'LI',
	'LK',
	'LT',
	'LU',
	'LV',
	'LY',
	'MA',
	'ME',
	'MK',
	'MT',
	'MX',
	'MY',
	'NG',
	'NI',
	'NL',
	'NO',
	'NP',
	'NZ',
	'OM',
	'PA',
	'PE',
	'PG',
	'PH',
	'PK',
	'PL',
	'PR',
	'PT',
	'PY',
	'QA',
	'RO',
	'RS',
	'RU',
	'SA',
	'SE',
	'SG',
	'SI',
	'SK',
	'SN',
	'SV',
	'TH',
	'TN',
	'TR',
	'TW',
	'TZ',
	'UA',
	'UG',
	'US',
	'UY',
	'VE',
	'VN',
	'YE',
	'ZA',
	'ZW'
] as const;

const contentRegionSet = new Set<string>(contentRegions);

export function isContentRegion(region: string | null | undefined): region is string {
	return !!region && contentRegionSet.has(region.trim().toUpperCase());
}

/**
 * Returns the normalized (uppercase) region if YouTube supports it, otherwise
 * `undefined`. Callers can use this to avoid forwarding unsupported regions
 * that may have been persisted by older versions.
 */
export function normalizeContentRegion(region: string | null | undefined): string | undefined {
	if (!region) return undefined;

	const normalized = region.trim().toUpperCase();
	return contentRegionSet.has(normalized) ? normalized : undefined;
}
