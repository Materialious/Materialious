export async function manifestDomainInclusion(manifestUrl: string): Promise<string> {
	const respIvg = await fetch(manifestUrl, {
		method: 'GET',
		headers: {
			// Required for our custom android backend.
			__redirect: 'manual'
		},
		referrerPolicy: 'no-referrer'
	});

	if (!respIvg.ok) {
		throw Error('Unable to make request to Invidious');
	}

	// If location isn't present, then use base manifest URL.
	const companionUrl = respIvg.headers.get('location') ?? manifestUrl;

	const respCompanion = await fetch(companionUrl, {
		method: 'GET'
	});

	if (!respCompanion.ok) {
		throw Error('Unable to make request to Companion');
	}

	const manifestText = await respCompanion.text();

	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(manifestText, 'application/xml');

	const baseUrlElements = xmlDoc.getElementsByTagName('BaseURL');

	for (let i = 0; i < baseUrlElements.length; i++) {
		const baseUrlElement = baseUrlElements[i];
		const baseUrlValue = baseUrlElement.textContent;

		if (baseUrlValue && (baseUrlValue.startsWith('/') || !baseUrlValue.includes('://'))) {
			const companionUrlObj = new URL(companionUrl);
			const baseDomain = `${companionUrlObj.protocol}//${companionUrlObj.host}`;
			const resolvedUrl = new URL(baseUrlValue, baseDomain).href;
			baseUrlElement.textContent = resolvedUrl;
		}
	}

	const serializer = new XMLSerializer();
	const updatedManifest = serializer.serializeToString(xmlDoc);

	return `data:application/dash+xml;base64,${btoa(updatedManifest)}`;
}
