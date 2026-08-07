export async function webPoTokenMinter(requestKey: string, visitorData: string): Promise<string> {
	const resp = await fetch('/api/poToken/', {
		body: JSON.stringify({
			requestKey,
			visitorData
		}),
		method: 'POST'
	});

	if (!resp.ok) {
		let errorMsg = 'An error occurred';
		try {
			errorMsg = (await resp.json()).message;
		} catch {
			// Ignore error
		}

		throw new Error(errorMsg);
	}

	return await resp.text();
}
