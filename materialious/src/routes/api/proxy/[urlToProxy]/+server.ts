async function proxyRequest(request: Request, urlToProxy: string): Promise<Response> {
	let urlToProxyObj: URL;
	try {
		urlToProxyObj = new URL(decodeURIComponent(urlToProxy));
	} catch {
		return new Response('Invalid URL', { status: 400 });
	}

	if (urlToProxyObj.pathname.includes('v1/player')) {
		urlToProxyObj.searchParams.set(
			'$fields',
			'playerConfig,captions,playabilityStatus,streamingData,responseContext.mainAppWebResponseContext.datasyncId,videoDetails.isLive,videoDetails.isLiveContent,videoDetails.title,videoDetails.author,playbackTracking'
		);
	}

	const requestHeaders = request.headers;
	requestHeaders.set('host', urlToProxyObj.host);
	requestHeaders.set('origin', urlToProxyObj.origin);

	for (const key of [
		'referer',
		'x-forwarded-for',
		'x-requested-with',
		'sec-ch-ua-mobile',
		'sec-ch-ua',
		'sec-ch-ua-platform'
	]) {
		requestHeaders.delete(key);
	}

	const fetchRes = await fetch(urlToProxy.toString(), {
		method: request.method,
		headers: requestHeaders,
		body: request.body,
		credentials: 'same-origin',
		...(request.body ? { duplex: 'half' } : {})
	});

	return new Response(fetchRes.body, {
		status: fetchRes.status
	});
}

export async function GET({ request, params }) {
	return await proxyRequest(request, params.urlToProxy);
}
export async function PATCH({ request, params }) {
	return await proxyRequest(request, params.urlToProxy);
}

export async function DELETE({ request, params }) {
	return await proxyRequest(request, params.urlToProxy);
}

export async function PUT({ request, params }) {
	return await proxyRequest(request, params.urlToProxy);
}

export async function POST({ request, params }) {
	return await proxyRequest(request, params.urlToProxy);
}
