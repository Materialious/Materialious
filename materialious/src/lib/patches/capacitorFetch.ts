import type { HttpResponse } from '@capacitor/core';
import { CapacitorHttp } from '@capacitor/core';
import type { CapFormDataEntry, WindowCapacitor } from '@capacitor/core/types/definitions-internal';

// Rip from https://github.com/ionic-team/capacitor/blob/912d532cf6c7424d180b185120e7a9ba9c1ae050/core/native-bridge.ts
// with some modifications.

const CAPACITOR_HTTP_INTERCEPTOR = '/_capacitor_http_interceptor_';
const CAPACITOR_HTTP_INTERCEPTOR_URL_PARAM = 'u';

const isRelativeOrProxyUrl = (url: string | undefined): boolean =>
  !url ||
  !(url.startsWith('http:') || url.startsWith('https:')) ||
  url.indexOf(CAPACITOR_HTTP_INTERCEPTOR) > -1;

const createProxyUrl = (url: string, win: WindowCapacitor): string => {
  if (isRelativeOrProxyUrl(url)) return url;
  const bridgeUrl = new URL(win.Capacitor?.getServerUrl() ?? '');
  bridgeUrl.pathname = CAPACITOR_HTTP_INTERCEPTOR;
  bridgeUrl.searchParams.append(CAPACITOR_HTTP_INTERCEPTOR_URL_PARAM, url);

  return bridgeUrl.toString();
};

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const data = reader.result as string;
      resolve(btoa(data));
    };
    reader.onerror = reject;

    reader.readAsBinaryString(file);
  });

const convertFormData = async (formData: FormData): Promise<any> => {
  const newFormData: CapFormDataEntry[] = [];
  for (const pair of formData.entries()) {
    const [key, value] = pair;
    if (value instanceof File) {
      const base64File = await readFileAsBase64(value);
      newFormData.push({
        key,
        value: base64File,
        type: 'base64File',
        contentType: value.type,
        fileName: value.name,
      });
    } else {
      newFormData.push({ key, value, type: 'string' });
    }
  }

  return newFormData;
};

const convertBody = async (
  body: Document | XMLHttpRequestBodyInit | ReadableStream<any> | undefined,
  contentType?: string,
): Promise<any> => {
  if (body instanceof ReadableStream || body instanceof Uint8Array) {
    let encodedData;
    if (body instanceof ReadableStream) {
      const reader = body.getReader();
      const chunks: any[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const concatenated = new Uint8Array(
        chunks.reduce((acc, chunk) => acc + chunk.length, 0),
      );
      let position = 0;
      for (const chunk of chunks) {
        concatenated.set(chunk, position);
        position += chunk.length;
      }
      encodedData = concatenated;
    } else {
      encodedData = body;
    }

    let data = new TextDecoder().decode(encodedData);
    let type;
    if (contentType === 'application/json') {
      try {
        data = JSON.parse(data);
      } catch (ignored) {
        // ignore
      }
      type = 'json';
    } else if (contentType === 'multipart/form-data') {
      type = 'formData';
    } else if (contentType?.startsWith('image')) {
      type = 'image';
    } else if (contentType === 'application/octet-stream') {
      type = 'binary';
    } else {
      type = 'text';
    }

    return {
      data,
      type,
      headers: { 'Content-Type': contentType || 'application/octet-stream' },
    };
  } else if (body instanceof URLSearchParams) {
    return {
      data: body.toString(),
      type: 'text',
    };
  } else if (body instanceof FormData) {
    const formData = await convertFormData(body);
    return {
      data: formData,
      type: 'formData',
    };
  } else if (body instanceof File) {
    const fileData = await readFileAsBase64(body);
    return {
      data: fileData,
      type: 'file',
      headers: { 'Content-Type': body.type },
    };
  }

  return { data: body, type: 'json' };
};

export const capacitorFetch = async (
  resource: RequestInfo | URL,
  options?: RequestInit,
) => {
  const request = new Request(resource, options);
  const { method } = request;
  if (
    method.toLocaleUpperCase() === 'GET' ||
    method.toLocaleUpperCase() === 'HEAD' ||
    method.toLocaleUpperCase() === 'OPTIONS' ||
    method.toLocaleUpperCase() === 'TRACE'
  ) {
    if (typeof resource === 'string') {
      return await fetch(
        createProxyUrl(resource, window as WindowCapacitor),
        options,
      );
    } else if (resource instanceof Request) {
      const modifiedRequest = new Request(
        createProxyUrl(resource.url, window as WindowCapacitor),
        resource,
      );
      return await fetch(modifiedRequest, options);
    }
  }

  const tag = `CapacitorHttp fetch ${Date.now()} ${resource}`;
  console.time(tag);

  try {
    const { body } = request;
    const optionHeaders = Object.fromEntries(request.headers.entries());
    const {
      data: requestData,
      type,
      headers,
    } = await convertBody(
      options?.body || body || undefined,
      optionHeaders['Content-Type'] || optionHeaders['content-type'],
    );

    const nativeResponse: HttpResponse = await CapacitorHttp.request({
      url: request.url,
      method: method,
      data: requestData,
      dataType: type,
      headers: {
        ...headers,
        ...optionHeaders,
      },
    });

    const contentType =
      nativeResponse.headers['Content-Type'] ||
      nativeResponse.headers['content-type'];
    let data = contentType?.startsWith('application/json')
      ? JSON.stringify(nativeResponse.data)
      : nativeResponse.data;

    // use null data for 204 No Content HTTP response
    if (nativeResponse.status === 204) {
      data = null;
    }

    // intercept & parse response before returning
    const response = new Response(data, {
      headers: nativeResponse.headers,
      status: nativeResponse.status,
    });

    /*
     * copy url to response, `cordova-plugin-ionic` uses this url from the response
     * we need `Object.defineProperty` because url is an inherited getter on the Response
     * see: https://stackoverflow.com/a/57382543
     * */
    Object.defineProperty(response, 'url', {
      value: nativeResponse.url,
    });

    console.timeEnd(tag);
    return response;
  } catch (error) {
    console.timeEnd(tag);
    return Promise.reject(error);
  }
};