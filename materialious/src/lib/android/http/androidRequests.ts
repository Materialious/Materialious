import { goto } from "$app/navigation";
import { Capacitor } from "@capacitor/core";
import { capacitorFetch } from "./capacitorFetch";

export const localProxy = 'http://localhost:3000/';

if (Capacitor.getPlatform() === 'android') {
  const originalFetch = window.fetch;

  window.fetch = async (
    requestInput: string | URL | Request, requestOptions?: RequestInit
  ): Promise<Response> => {
    if (requestInput.toString().startsWith(localProxy)) {
      return originalFetch(requestInput, requestOptions);
    }

    return capacitorFetch(requestInput, requestOptions);
  };

  setTimeout(() => goto('/', { replaceState: true }), 10);
}