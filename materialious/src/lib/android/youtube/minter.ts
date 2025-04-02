import { BG, buildURL, GOOG_API_KEY, type WebPoSignalOutput } from 'bgutils-js';
import { Innertube } from 'youtubei.js';

type WebPoMinter = {
  sessionPoToken: string;
  contentPoToken: string;
};

export async function androidPoTokenMinter(youtube: Innertube, videoId: string): Promise<WebPoMinter> {
  const requestKey = 'O43z0dpjhgX20SCx4KAo';

  const challengeResponse = await youtube.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');

  if (!challengeResponse.bg_challenge)
    throw new Error('Yt.js: Could not get challenge');

  const interpreterUrl = challengeResponse.bg_challenge.interpreter_url.private_do_not_access_or_else_trusted_resource_url_wrapped_value;
  const bgScriptResponse = await fetch(`https:${interpreterUrl}`);
  const interpreterJavascript = await bgScriptResponse.text();

  if (interpreterJavascript) {
    new Function(interpreterJavascript)();
  } else throw new Error('Could not load VM');

  const botguardClient = await BG.BotGuardClient.create({
    program: challengeResponse.bg_challenge.program,
    globalName: challengeResponse.bg_challenge.global_name,
    globalObj: globalThis
  });

  const webPoSignalOutput: WebPoSignalOutput = [];
  const botguardResponse = await botguardClient.snapshot({ webPoSignalOutput });

  const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
    method: 'POST',
    headers: {
      'content-type': 'application/json+protobuf',
      'x-goog-api-key': GOOG_API_KEY,
      'x-user-agent': 'grpc-web-javascript/0.1',
    },
    body: JSON.stringify([requestKey, botguardResponse])
  });

  const integrityTokenResponseData = await integrityTokenResponse.json();

  if (typeof integrityTokenResponseData[0] !== 'string')
    throw new Error('Yt.js: Could not get integrity token');

  const integrityToken = integrityTokenResponseData[0];

  const integrityTokenBasedMinter = await BG.WebPoMinter.create({ integrityToken }, webPoSignalOutput);

  return {
    sessionPoToken: await integrityTokenBasedMinter.mintAsWebsafeString(youtube.session.context.client.visitorData ?? ''),
    contentPoToken: await integrityTokenBasedMinter.mintAsWebsafeString(videoId)
  };
}