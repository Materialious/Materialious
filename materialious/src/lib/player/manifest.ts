export async function manifestDomainInclusion(manifestUrl: string): Promise<string> {
	const resp = await fetch(manifestUrl, {
		method: 'GET',
		referrerPolicy: 'no-referrer'
	});

	if (!resp.ok) {
		throw Error('Unable to make request to Invidious');
	}

	// Used to resolve relative BaseURL entries in the manifest.
	const companionUrl = resp.headers.get('x-final-url') ?? manifestUrl;
	const manifestText = await resp.text();

	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(manifestText, 'application/xml');

	const baseUrlElements = xmlDoc.getElementsByTagName('BaseURL');

	for (let i = 0; i < baseUrlElements.length; i++) {
		const baseUrlElement = baseUrlElements[i];
		const baseUrlValue = baseUrlElement.textContent;

		if (baseUrlValue && (baseUrlValue.startsWith('/') || !baseUrlValue.includes('://'))) {
			baseUrlElement.textContent = new URL(baseUrlValue, companionUrl).href;
		}
	}

	const serializer = new XMLSerializer();
	const updatedManifest = serializer.serializeToString(xmlDoc);

	return `data:application/dash+xml;base64,${btoa(updatedManifest)}`;
}
