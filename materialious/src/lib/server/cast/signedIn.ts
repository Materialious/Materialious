import { mintPoTokenInJSDOM } from '@materialious/shared/jsdom';
import { USER_AGENT } from 'bgutils-js/utils';
import { Innertube, UniversalCache } from 'youtubei.js';

/** The same request key the anonymous download session mints with. */
const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';

/**
 * A playback session signed in as somebody's own YouTube account, for a video
 * YouTube will not play to nobody in particular.
 *
 * YouTube has taken to answering this instance's address with "Sign in to
 * confirm you're not a bot" for most videos, and lets a signed-in account
 * through. A television has the account's saved cookies and hands them over
 * when it starts a video; they are used for that video's session and kept for
 * nothing else, and never written anywhere.
 *
 * The session asks for the video without a token; the one it streams with,
 * bound to the video, is handed back beside it.
 */
export async function getSignedInSession(
	cookie: string,
	videoId: string,
	/** A token already minted for this video, which is used rather than another. */
	videoPoToken?: string
): Promise<{
	innertube: Innertube;
	withPlayerToken: () => Promise<Innertube>;
	streamingPoToken?: string;
}> {
	// The library sends the cookies only with its API calls, so the session
	// was set up - its visitor identity, its configuration - anonymously, from
	// an address YouTube is asking to prove it is not a bot, and every signed-in
	// call after it came back "logged out". The website sends them with
	// everything for youtube.com, and is let through; so does this. Only
	// youtube.com: not the video servers, nor anything else.
	const signedInFetch: typeof fetch = (input, init) => {
		const url = new URL(input instanceof Request ? input.url : input.toString());
		const host = url.hostname.toLowerCase();
		if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return fetch(input, init);

		const headers = new Headers(
			init?.headers ?? (input instanceof Request ? input.headers : undefined)
		);
		headers.set('cookie', cookie);

		return fetch(input, { ...init, headers });
	};

	const create = (poToken?: string) =>
		Innertube.create({
			fetch: signedInFetch,
			cookie,
			// Its own cache: an anonymous session's visitor data must not end up
			// as part of an account's identity, nor the other way about.
			cache: new UniversalCache(false),
			enable_session_cache: false,
			user_agent: USER_AGENT,
			...(poToken ? { po_token: poToken } : {})
		});

	const probe = await create();

	// Whether the cookies still sign anybody in, from a page YouTube does not
	// bot-check.
	const answer = await probe.actions.execute('/guide', { parse: false });

	const data = (typeof answer.data === 'string' ? JSON.parse(answer.data) : answer.data) as {
		responseContext?: { mainAppWebResponseContext?: { loggedOut?: boolean } };
	};

	const context = data?.responseContext?.mainAppWebResponseContext;

	if (context?.loggedOut) {
		// Which cookies were there, for telling an incomplete set from one
		// Google has since signed out. Names only: the values are the account.
		const names = cookie
			.split(';')
			.map((pair) => pair.split('=')[0].trim())
			.filter(Boolean);

		throw new Error(
			`The saved YouTube account is signed out (cookies: ${names.join(', ')}); save its cookies again`
		);
	}

	// Streaming is done with a token bound to the video, signed in or not.
	// Bound to the account - as this used to be - the streaming server marks
	// a signed-in stream "attestation pending" from its first answer, sends a
	// minute's grace and then nothing. The player is asked without a token,
	// and only a session that asks with one is offered for the case YouTube
	// will not answer without.
	let streamingPoToken = videoPoToken;
	try {
		streamingPoToken ??= await mintPoTokenInJSDOM(REQUEST_KEY, videoId);
	} catch (error) {
		console.warn(
			'cast: could not mint a token for a signed-in session:',
			error instanceof Error ? error.message : error
		);
	}

	return {
		innertube: probe,
		withPlayerToken: async () =>
			create(streamingPoToken ?? (await mintPoTokenInJSDOM(REQUEST_KEY, videoId))),
		streamingPoToken
	};
}
