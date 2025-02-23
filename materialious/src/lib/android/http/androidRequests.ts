import { goto } from "$app/navigation";
import { Capacitor } from "@capacitor/core";

if (Capacitor.getPlatform() === 'android') {
  const originalFetch = window.fetch;

  const corsProxyUrl: string = 'http://localhost:3000/';

  window.fetch = async (requestInput: string | URL | Request, requestOptions?: RequestInit): Promise<Response> => {
    let requestUrl: string;

    if (typeof requestInput === 'string') {
      requestUrl = requestInput;
    } else if ('url' in requestInput) {
      requestUrl = requestInput.url;
    } else {
      requestUrl = requestInput.toString();
    }

    if (!requestUrl.startsWith(corsProxyUrl) && !requestUrl.startsWith('/') && !requestUrl.startsWith('blob:')) {
      requestInput = corsProxyUrl + requestUrl;
    }

    // Use the original fetch with the proxied URL and options
    return originalFetch(requestInput, requestOptions);
  };

  const currentOrigin: string = window.location.protocol + '//' + window.location.host;
  const originalXhrOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function (...args: any[]): void {
    const targetOriginMatch = /^https?:\/\/([^\/]+)/i.exec(args[1]);
    if (targetOriginMatch && targetOriginMatch[0].toLowerCase() !== currentOrigin) {
      args[1] = corsProxyUrl + args[1];
    }
    /* @ts-ignore */
    return originalXhrOpen.apply(this, args);
  };

  setTimeout(() => goto('/', { replaceState: true }), 10);
}
