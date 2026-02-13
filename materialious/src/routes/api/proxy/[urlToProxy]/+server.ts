function copyHeader(header: string, targetHeaders: Headers, sourceHeaders: Headers) {
	if (sourceHeaders.has(header)) {
		targetHeaders.set(header, sourceHeaders.get(header)!);
	}
}

async function proxyRequest(request: Request, urlToProxy: string): Promise<Response> {
	let urlToProxyObj: URL;
	try {
		urlToProxyObj = new URL(decodeURIComponent(urlToProxy));
	} catch {
		return new Response('Invalid URL', { status: 400 });
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

	const responseHeaders = new Headers();
	copyHeader('content-length', requestHeaders, fetchRes.headers);
	copyHeader('content-type', requestHeaders, fetchRes.headers);
	copyHeader('content-disposition', requestHeaders, fetchRes.headers);
	copyHeader('accept-ranges', requestHeaders, fetchRes.headers);
	copyHeader('content-range', requestHeaders, fetchRes.headers);

	return new Response(fetchRes.body, {
		status: fetchRes.status,
		headers: responseHeaders
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

export async function OPTIONS() {
	return new Response('', {
		status: 200
	});
}
