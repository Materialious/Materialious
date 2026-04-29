import { invidiousInstanceStore } from '$lib/store';
import { get } from 'svelte/store';

export async function manifestDomainInclusion(manifestUrl: string): Promise<string> {
	const respCompanion = await fetch(manifestUrl, {
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
			baseUrlElement.textContent = new URL(baseUrlValue, get(invidiousInstanceStore) ?? '').href;
		}
	}

	const serializer = new XMLSerializer();
	const updatedManifest = serializer.serializeToString(xmlDoc);

	return `data:application/dash+xml;base64,${btoa(updatedManifest)}`;
}
