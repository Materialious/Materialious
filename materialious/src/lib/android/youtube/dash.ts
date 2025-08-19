export async function dashManifestDomainInclusion(manifestUrl: string): Promise<string> {
	/* If on android, must manually format dash manifest to include URL. */

	const response = await fetch(manifestUrl, {
		method: 'GET',
		redirect: 'follow'
	});

	if (!response.ok) {
		throw Error('Unable to fetch manifest');
	}

	const finalUrl = response.url;
	const manifestText = await response.text();

	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(manifestText, 'application/xml');

	// Find all BaseURL elements
	const baseUrlElements = xmlDoc.getElementsByTagName('BaseURL');

	for (let i = 0; i < baseUrlElements.length; i++) {
		const baseUrlElement = baseUrlElements[i];
		const baseUrlValue = baseUrlElement.textContent;

		if (baseUrlValue && (baseUrlValue.startsWith('/') || !baseUrlValue.includes('://'))) {
			const finalUrlObj = new URL(finalUrl);
			const baseDomain = `${finalUrlObj.protocol}//${finalUrlObj.host}`;
			const resolvedUrl = new URL(baseUrlValue, baseDomain).href;
			baseUrlElement.textContent = resolvedUrl;
		}
	}

	const serializer = new XMLSerializer();
	const updatedManifest = serializer.serializeToString(xmlDoc);

	console.log(updatedManifest);

	return `data:application/dash+xml;base64,${btoa(updatedManifest)}`;
}
