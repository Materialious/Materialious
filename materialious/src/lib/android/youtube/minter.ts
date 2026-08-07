import { fetchInnerTubeChallenge, mintPoToken } from '$lib/youtube/poToken';

export async function androidPoTokenMinter(requestKey: string, visitorData: string): Promise<string> {
	const { ytConfig, challengeResponse, interpreterJavascript } = await fetchInnerTubeChallenge();

	window.yt = { config_: JSON.parse(ytConfig) };

	const interpreterHash = challengeResponse.bgChallenge?.interpreterHash;

	if (interpreterHash && !document.getElementById(interpreterHash)) {
		const script = document.createElement('script');
		script.type = 'text/javascript';
		script.id = interpreterHash;
		script.textContent = interpreterJavascript;
		document.head.appendChild(script);
	}

	return await mintPoToken(requestKey, visitorData, challengeResponse);
}
