import type { ApiObject, QueryParams, RequestOptions } from "../core/types";
import { Resource, requestOptions, segment } from "./shared";

/**
 * Query for `GET /analytics/links/{public_id}`. The endpoint documents no
 * parameters today (the totals cover the link's whole history); anything set
 * here is sent as is.
 */
export type LinkAnalyticsQuery = QueryParams;

export interface LinkAnalytics extends ApiObject {
  total_clicks: number;
  unique_clicks: number;
  /** Clicks per country name; unknown countries under `Unknown`. */
  clicks_by_country: Record<string, number>;
}

/** A link's click totals. Needs `analytics:read`; counts toward the analytics rate limit. */
export class AnalyticsResource extends Resource {
  /** `GET /analytics/links/{public_id}`. */
  link(publicId: string, query: LinkAnalyticsQuery = {}, options?: RequestOptions): Promise<LinkAnalytics> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: `/analytics/links/${segment(publicId, "publicId")}`,
      query
    });
  }
}
