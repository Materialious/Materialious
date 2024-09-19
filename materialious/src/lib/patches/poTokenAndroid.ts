import { InAppBrowser } from '@capgo/inappbrowser';
import { minify } from 'terser';

export interface PoTokens {
  visitor_data: string;
  po_token: string;
}

export async function getPoToken(): Promise<PoTokens> {
  return new Promise((resolve, reject) => {
    const messageListener = async (data: any) => {
      await InAppBrowser.removeAllListeners();
      await InAppBrowser.close();
      resolve(data);
    };

    const closeListener = async () => {
      await InAppBrowser.removeAllListeners();
    };

    const urlChangeListener = async () => {

      // Code must be minified to ensure runs correctly.
      await InAppBrowser.executeScript({
        code: (await minify(`const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url) {
  this._url = url;
  originalOpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function (body) {
  const xhr = this;
  if (this._url.includes("/youtubei/v1/player")) {
    this.addEventListener("load", function () {
      try {
        const postJson = JSON.parse(body);
        window.mobileApp.postMessage({visitor_data: postJson.context.client.visitorData, po_token: postJson.serviceIntegrityDimensions.poToken});
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
    }, 10000);

    InAppBrowser.openWebView({
      url: "https://www.youtube.com/embed/jNQXAC9IVRw",
      isPresentAfterPageLoad: true,
    });
  });
}
