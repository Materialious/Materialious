import { goto } from "$app/navigation";
import { Capacitor } from "@capacitor/core";


if (Capacitor.getPlatform() === 'android') {
  const originalFetch = window.fetch;

  // CORS-Anywhere proxy URL
  const corsAnywhereProxyUrl: string = 'http://localhost:3000/';

  // Overwrite fetch to use CORS-Anywhere proxy
  window.fetch = async (requestInput: RequestInfo | URL, requestOptions: RequestInit = {}): Promise<Response> => {
    const requestUrl: string =
      typeof requestInput === 'string' ? requestInput : requestInput.toString();

    // Check if the URL is already proxied, to avoid double proxying
    if (!requestUrl.startsWith(corsAnywhereProxyUrl) && !requestUrl.startsWith('/')) {
      requestInput = corsAnywhereProxyUrl + requestUrl;
    }

    // Ensure options.method is set to a valid value
    requestOptions.method = requestOptions.method ? requestOptions.method.toUpperCase() : 'GET';

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

  // Must reload page after patches
  goto('/', { replaceState: true });
}