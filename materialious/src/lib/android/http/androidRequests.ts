import { goto } from "$app/navigation";
import { Capacitor } from "@capacitor/core";

if (Capacitor.getPlatform() === 'android') {
  const originalFetch = window.fetch;

  // CORS-Anywhere proxy URL
  const corsAnywhereProxyUrl: string = 'http://localhost:3000/';

  // Overwrite fetch to use CORS-Anywhere proxy
  window.fetch = async (requestInput: string | URL | Request, requestOptions?: RequestInit): Promise<Response> => {
    let requestUrl: string;

    if (typeof requestInput === 'string') {
      requestUrl = requestInput;
    } else if ('url' in requestInput) {
      requestUrl = requestInput.url;
      requestOptions = {
        body: requestInput.body,
        cache: requestInput.cache,
        credentials: requestInput.credentials,
        headers: requestInput.headers,
        method: requestInput.method,
        mode: requestInput.mode,
        redirect: requestInput.redirect,
        referrer: requestInput.referrer,
        signal: requestInput.signal,
      };
    } else {
      requestUrl = requestInput.toString();
    }

    if (!requestUrl.startsWith(corsAnywhereProxyUrl) && !requestUrl.startsWith('/') && !requestUrl.startsWith('blob:')) {
      requestInput = corsAnywhereProxyUrl + requestUrl;
    }


    // Use the original fetch with the proxied URL and options
    return originalFetch(requestInput, requestOptions);
  };

  const currentOrigin: string = window.location.protocol + '//' + window.location.host;
  const originalXhrOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function (...args: any[]): void {
    const targetOriginMatch = /^https?:\/\/([^\/]+)/i.exec(args[1]);
    if (targetOriginMatch && targetOriginMatch[0].toLowerCase() !== currentOrigin) {
      args[1] = corsAnywhereProxyUrl + args[1];
    }
    /* @ts-ignore */
    return originalXhrOpen.apply(this, args);
  };

  setTimeout(() => goto('/', { replaceState: true }), 10);
}
