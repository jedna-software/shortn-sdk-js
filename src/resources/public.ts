import type { ApiObject, RequestOptions } from "../core/types";
import { Resource, requestOptions } from "./shared";

export interface UrlValidation extends ApiObject {
  valid: boolean;
  /** The URL as Shortn would store it, when valid. */
  normalized?: string;
  code?: string;
  error?: string;
}

export interface QrCodeParams {
  /** The URL the code opens, usually a short URL. */
  url: string;
  format?: "png" | "svg" | "jpg" | (string & {}) | undefined;
  size?: "preview" | "preview-hd" | "preview-final" | "preview-xl" | "download" | (string & {}) | undefined;
  colorMode?: "flat" | "gradient" | (string & {}) | undefined;
  /** Hex without `#`, such as `1f2937`. */
  fg?: string | undefined;
  /** Hex, or `transparent` (PNG and SVG). */
  bg?: string | undefined;
  gradientColors?: string | undefined;
  gradientStart?: string | undefined;
  gradientMiddle?: string | undefined;
  gradientEnd?: string | undefined;
  gradientDir?: string | undefined;
  qrShape?: string | undefined;
  finderShape?: string | undefined;
  cornerStyle?: string | undefined;
  borderPattern?: string | undefined;
  borderColor?: string | undefined;
  frameTemplate?: "none" | "scan" | "bubble" | (string & {}) | undefined;
  frameText?: string | undefined;
  frameTextColor?: string | undefined;
  frameTextFollowsBackground?: boolean | undefined;
  branding?: "default" | "none" | (string & {}) | undefined;
}

export interface Plan extends ApiObject {
  ID: string;
  Name: string;
  Description?: string;
  /** In cents. */
  Price: number;
  Currency: string;
  /** `month` or `year`. */
  Interval: string;
  Features?: unknown;
  PriceID?: string;
  /** Active-link limit; `-1` is unlimited. */
  MaxLinks: number;
  /** Monthly click limit; `-1` is unlimited. */
  MaxClicks: number;
}

export interface PlanCatalog extends ApiObject {
  /** Keyed by plan ID: `free`, `starter`, `professional`, `agency`, and `*_yearly`. */
  plans: Record<string, Plan>;
}

/** Endpoints that need no API key (a key, when set, is sent anyway). */
export class PublicResource extends Resource {
  /** `GET /validate?url=`: whether a URL can be a destination. */
  validateUrl(url: string, options?: RequestOptions): Promise<UrlValidation> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: "/validate",
      query: { url }
    });
  }

  /** `GET /qr`: the QR code image's bytes (PNG by default). */
  qrCode(params: QrCodeParams, options?: RequestOptions): Promise<Uint8Array> {
    const accept = params.format === "svg"
      ? "image/svg+xml"
      : params.format === "jpg"
        ? "image/jpeg"
        : "image/png";
    return this.http.requestBytes({
      ...requestOptions(options),
      headers: { Accept: `${accept}, application/json;q=0.5`, ...options?.headers },
      method: "GET",
      path: "/qr",
      query: { ...params }
    });
  }

  /** `GET /plans`: the plan catalog. Its fields are capitalized. */
  plans(options?: RequestOptions): Promise<PlanCatalog> {
    return this.http.request({ ...requestOptions(options), method: "GET", path: "/plans" });
  }
}
