import { goto } from "$app/navigation";
import { Capacitor } from "@capacitor/core";

if (Capacitor.getPlatform() === 'android') {
  const originalFetch = window.fetch;

  const currentOrigin: string = window.location.protocol + '//' + window.location.host;

  function needsProxying(target: string): boolean {
    const targetOriginMatch = /^https?:\/\/([^\/]+)/i.exec(target);
    return (targetOriginMatch && targetOriginMatch[0].toLowerCase()) !== currentOrigin;
  }

  const corsProxyUrl: string = 'http://localhost:3000/';

  window.fetch = async (requestInput: string | URL | Request, requestOptions?: RequestInit): Promise<Response> => {
    const uri = requestInput.toString();

    console.log(uri, needsProxying(uri));

    if (needsProxying(uri)) {
      requestInput = corsProxyUrl + uri;
    }

    console.log(requestInput);

    // Use the original fetch with the proxied URL and options
    return originalFetch(requestInput, requestOptions);
  };

  const originalXhrOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function (...args: any[]): void {
    if (needsProxying(args[1])) {
      args[1] = corsProxyUrl + args[1];
    }
    /* @ts-ignore */
    return originalXhrOpen.apply(this, args);
  };

  setTimeout(() => goto('/', { replaceState: true }), 100);
}
