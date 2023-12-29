import type { ClientRequest } from "node:http";
import { Readable } from "node:stream";
import { request, RequestOptions } from "node:https";

// interface ExtraFetchOpts {}
export function unsafeFetch(url: string, options: RequestInit = {}) {
  const { body, method } = options;
  if ((method === "GET" || method === "HEAD") && body) throw new Error(method + "method unable have body");
  let headers: Record<string, string> = {};
  let rawHeaders = options.headers;
  if (rawHeaders) {
    if (rawHeaders instanceof Headers) {
      rawHeaders = Array.from(rawHeaders.entries());
    }
    if (Array.isArray(rawHeaders)) {
      for (const [k, v] of rawHeaders) headers[k] = v;
    } else headers = rawHeaders as any; //todo Record<string, string[]> 类型的处理
  }

  if (body == undefined || body === null || typeof body === "string" || body instanceof Uint8Array) {
    return mReq(url, {
      method: options.method,
      body: body,
      headers,
      redirect: options.redirect,
    });
  }
  throw new Error("unimplemented body type");
}
interface RequestConfig {
  method?: string;
  headers?: Record<string, number | string | string[]>;
  body?: Uint8Array | string | null;
  redirect?: "follow" | "error" | "manual";
}
function mReq(url: string, options: RequestConfig = {}, redirected = false) {
  return new Promise<Response>(function (resolve, reject) {
    const redirectMod = options.redirect ?? "follow";
    const reqOptions: RequestOptions = {
      headers: options.headers,
      method: options.method,
      rejectUnauthorized: false,
    };
    const req = request(url, reqOptions, function (this: ClientRequest, res) {
      if (res.statusCode === 302 || res.statusCode === 301) {
        switch (redirectMod) {
          case "follow": {
            const url = res.headers.location;
            if (typeof url === "string") return resolve(mReq(url, options, true));
            break;
          }
          case "error":
            throw new Error("Response redirect");
          default:
            break;
        }
      }

      const req = this;
      const url = req.protocol + "//" + req.host + req.path;
      const readableStream = Readable.toWeb(res) as ReadableStream<Uint8Array>;

      const response = new Response(readableStream, {
        headers: new Headers(res.headers as Record<string, string>),
        status: res.statusCode,
        statusText: res.statusMessage,
      });
      Object.defineProperty(response, "url", { value: url, writable: false });
      if (redirected) Object.defineProperty(response, "redirected", { value: true, writable: false });
      resolve(response);
    });
    req.once("error", reject);

    if (options.body) req.write(options.body);
    req.end();
  });
}
