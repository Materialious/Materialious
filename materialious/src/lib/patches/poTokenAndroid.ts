import { InAppBrowser } from '@capgo/inappbrowser';
import { minify } from 'terser';

export interface PoTokens {
  visitor_data: string;
  po_token: string;
}

const headers = {
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-language': 'en-US;q=0.9',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
};

// Inspired by https://github.com/YunzheZJU/youtube-po-token-generator & https://github.com/YunzheZJU/youtube-po-token-generator
export async function getPoToken(): Promise<PoTokens> {
  let visitorData: string;

  return new Promise((resolve, reject) => {
    const messageListener = async (data: any) => {

      if (!data.po_token) {
        visitorData = data.visitor_data;
        const injectPlayer = await fetch('/po-token-youtube/inject.js');

        await InAppBrowser.executeScript({
          code: (await minify(`
window.onPoToken = (poToken) => {
  window.mobileApp.postMessage({po_token: poToken});
}

ytcfg.set({
    'INNERTUBE_CONTEXT': {
        ...ytcfg.get('INNERTUBE_CONTEXT'),
        client: {
            ...ytcfg.get('INNERTUBE_CONTEXT').client,
            visitorData: "${visitorData}",
        },
    },
    'VISITOR_DATA': "${visitorData}",
    'IDENTITY_MEMENTO': {
        'visitor_data': "${visitorData}",
    },
})

${await injectPlayer.text()}`)).code as string
        });
      } else if (visitorData && data.po_token) {
        await InAppBrowser.removeAllListeners();
        await InAppBrowser.close();
        resolve({ visitor_data: visitorData, po_token: data.po_token });
      }
    };

    const closeListener = async () => {
      await InAppBrowser.removeAllListeners();
    };

    const urlChangeListener = async () => {
      // Code must be minified to ensure runs correctly.
      await InAppBrowser.executeScript({
        code: (await minify(`const headers = {"accept": "${headers.accept}", "accept-language": "${headers['accept-language']}", "user-agent": "${headers['user-agent']}"};
Object.defineProperty(window.navigator, 'userAgent', { value: headers["user-agent"], writable: false });

const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url) {
  this._url = url;
  originalOpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function (body) {
  const xhr = this;
  if (this._url.includes("/youtubei/v1/player")) {
    for (const [key, value] of Object.entries(headers)) {
      this.setRequestHeader(key, value);
    }

    this.addEventListener("load", function () {
      try {
        const postJson = JSON.parse(body);
        window.mobileApp.postMessage({visitor_data: postJson.context.client.visitorData});
      } catch (error) {
        console.error("Error parsing request body:", error);
      }
    });
  }
  originalSend.apply(this, arguments);
};

function attemptClickPlayButton() {
  const interval = setInterval(() => {
    const playButtons = document.getElementsByClassName("ytp-play-button");
    if (playButtons.length > 0) {
      playButtons[0].click();
      clearInterval(interval);
    }
  }, 100);
}

attemptClickPlayButton();
`)).code as string
      });
    };

    InAppBrowser.addListener('messageFromWebview', messageListener);
    InAppBrowser.addListener('closeEvent', closeListener);
    InAppBrowser.addListener('urlChangeEvent', urlChangeListener);

    setTimeout(() => {
      reject(new Error('Timeout trying to pull Po tokens'));
      InAppBrowser.removeAllListeners();
    }, 30000);

    InAppBrowser.openWebView({
      url: 'https://www.youtube.com/embed/jNQXAC9IVRw',
      title: 'Pulling po tokens (This may take a moment)',
      headers: headers
    });
  });
}
