import type {
  ApiObject,
  DateInput,
  JsonObject,
  Pagination,
  QueryParams,
  RequestOptions
} from "../core/types";
import { Resource, requestOptions } from "./shared";

export type LeadCategory =
  | "signup"
  | "form_submission"
  | "newsletter_signup"
  | "trial_started"
  | "add_to_cart"
  | "checkout_started"
  | "custom";

interface ConversionCommonParams {
  /** Up to 120 characters, such as `Sign up` or `Invoice paid`. */
  event_name?: string | undefined;
  /** A JSON object, up to 32 KiB. Keep personal data out of it. */
  metadata?: JsonObject | undefined;
  /** RFC 3339; now when omitted. */
  occurred_at?: DateInput | undefined;
  /**
   * Records a test event, kept out of live reports. The API never
   * deduplicates test events, so a test-mode write is never retried.
   */
  test_mode?: boolean | undefined;
  /** Optional; another type than the endpoint's is refused. */
  event_type?: "lead" | "sale" | "refund" | undefined;
}

/** Body of `POST /conversions/leads`. */
export interface TrackLeadParams extends ConversionCommonParams {
  click_id: string;
  /** Required: a stable key so a retry is recorded once. */
  idempotency_key: string;
  lead_category?: LeadCategory | (string & {}) | undefined;
  /** 1 by default, at most 10000. */
  event_quantity?: number | undefined;
}

/** Body of `POST /conversions/sales`. Send `amount_cents` or `amount`, not both. */
export interface TrackSaleParams extends ConversionCommonParams {
  click_id: string;
  /** ISO 4217, such as `EUR`, or a supported coin such as `BTC`. */
  currency: string;
  /** Hundredths of the currency's main unit. Fiat only: crypto needs `amount`. */
  amount_cents?: number | undefined;
  /**
   * The amount as a decimal string, with at most the currency's decimals: two
   * for fiat (`"49.00"`), the coin's own for crypto (`"0.00012345"` BTC).
   * Required for crypto.
   */
  amount?: string | undefined;
  /** Identifies the sale; this or `idempotency_key` is required. */
  invoice_id?: string | undefined;
  idempotency_key?: string | undefined;
  payment_processor?: string | undefined;
  /** What the sale settled for, in hundredths. Send with `settlement_currency`. */
  settlement_amount_cents?: number | undefined;
  settlement_currency?: string | undefined;
}

/** Body of `POST /conversions/refunds`. Send `amount_cents` or `amount`. */
export interface TrackRefundParams extends ConversionCommonParams {
  /** The sale's invoice ID. */
  invoice_id: string;
  /** Your refund ID; a retry with the same one is recorded once. */
  refund_id: string;
  amount_cents?: number | undefined;
  amount?: string | undefined;
  /** Takes the sale's when omitted; required with `amount`. */
  currency?: string | undefined;
  payment_processor?: string | undefined;
  /** Up to 500 characters. */
  reason?: string | undefined;
  idempotency_key?: string | undefined;
}

export interface ConversionAttribution extends ApiObject {
  type: string;
  user_public_id?: string;
  team_public_id?: string;
  partner_public_id?: string;
  external_id?: string;
  label?: string;
}

export interface ConversionEvent extends ApiObject {
  public_id: string;
  event_type: "lead" | "sale" | "refund" | (string & {});
  event_name: string;
  lead_category?: string;
  /** `observed`, or `inferred` for a lead a sale recorded. */
  event_origin?: string;
  /** Write answers only (see `ConversionWriteEvent`); absent on `events` rows. */
  duplicate?: boolean;
  is_test: boolean;
  click_id?: string;
  amount_cents?: number;
  amount?: string;
  currency_decimals?: number;
  currency?: string;
  invoice_id?: string;
  refunded_amount_cents?: number;
  remaining_amount_cents?: number;
  refund_status?: string;
  attribution: ConversionAttribution;
  occurred_at: string;
  created_at: string;
}

/** The event a write answers: `duplicate` is always set. */
export interface ConversionWriteEvent extends ConversionEvent {
  /** True when an earlier request with the same identity already recorded it. */
  duplicate: boolean;
}

export interface ConversionWriteResponse extends ApiObject {
  type: "lead" | "sale" | "refund" | (string & {});
  event: ConversionWriteEvent;
}

export interface ConversionValidationResult extends ApiObject {
  valid: boolean;
  dry_run: boolean;
  event_type: string;
  would_track?: boolean;
  would_create_event?: boolean;
  would_infer_lead?: boolean;
  duplicate?: boolean;
  is_test?: boolean;
}

export interface ConversionValidationResponse extends ApiObject {
  valid: boolean;
  dry_run: boolean;
  result: ConversionValidationResult;
}

/** Totals in the reporting currency. */
export interface ConversionReporting extends ApiObject {
  currency: string;
  sale_amount_cents?: number | null;
  refund_amount_cents?: number | null;
  net_revenue_cents?: number | null;
  approximate: boolean;
  rate_sources?: string[];
  excluded?: Array<{ currency: string; sales: number; refunds: number }>;
}

export interface ConversionSummary extends ApiObject {
  leads: number;
  sales: number;
  refunds: number;
  /** `null` when sales span several currencies. */
  sale_amount_cents: number | null;
  refund_amount_cents: number | null;
  net_revenue_cents: number | null;
  currency: string | null;
  mixed_currencies: boolean;
  monetary_totals_available: boolean;
  lead_to_sale_rate: number;
  reporting: ConversionReporting;
}

export interface ConversionSummaryResponse extends ApiObject {
  data: ConversionSummary;
}

/**
 * Query for `GET /conversions/summary`. It documents no parameters today (it
 * answers all-time live totals); anything set here is sent as is.
 */
export type ConversionSummaryQuery = QueryParams;

interface ConversionRangeQuery {
  /** RFC 3339 time or `YYYY-MM-DD`. Default: the last 14 days. */
  from?: DateInput | undefined;
  /** RFC 3339 time or `YYYY-MM-DD`; a date includes that day. */
  to?: DateInput | undefined;
  /** `live` (default) or `test`. */
  environment?: "live" | "test" | undefined;
}

export interface ConversionAttributionQuery extends ConversionRangeQuery {
  /** 1 to 100. Default 50. */
  limit?: number | undefined;
}

export interface ConversionTimelineQuery extends ConversionRangeQuery {
  /** `week` starts on Monday, `week_sunday` on Sunday. */
  interval?: "day" | "week" | "week_sunday" | "month" | undefined;
}

export interface ConversionEventsQuery extends ConversionRangeQuery {
  /** 1 to 100. Default 50. */
  limit?: number | undefined;
  offset?: number | undefined;
  event_type?: "lead" | "sale" | "refund" | undefined;
  lead_category?: LeadCategory | "purchase_inferred" | (string & {}) | undefined;
  event_origin?: "observed" | "inferred" | undefined;
  /** A link's public ID, short code, short URL or numeric ID. */
  link?: string | undefined;
  /** An event's public ID. */
  event?: string | undefined;
  /** Searches event names and attribution labels, up to 200 characters. */
  q?: string | undefined;
  /** Also count every matching event into `pagination.total` (sent as `include_total=1`). */
  include_total?: boolean | undefined;
}

export interface DateRange extends ApiObject {
  from?: string;
  to?: string;
  to_exclusive?: boolean;
}

/** Counts and money fields shared by attribution rows, totals and timeline points. */
export interface ConversionTotals extends ApiObject {
  clicks: number;
  leads: number;
  sales: number;
  refunds: number;
  /** `null` when the amounts span several currencies. */
  sale_amount_cents: number | null;
  refund_amount_cents: number | null;
  net_revenue_cents: number | null;
  currency: string | null;
  mixed_currencies: boolean;
  monetary_totals_available: boolean;
  click_to_lead_rate?: number;
  click_to_sale_rate?: number;
  lead_to_sale_rate?: number;
  /** Absent when there is nothing to report in the reporting currency. */
  reporting?: ConversionReporting;
}

export interface ConversionAttributionRow extends ConversionTotals {
  attribution: ConversionAttribution;
  display_name?: string;
  latest_event_at?: string;
}

export interface ConversionAttributionResponse extends ApiObject {
  data: ConversionAttributionRow[];
  totals: ConversionTotals;
  pagination: ApiObject;
  date_range: DateRange;
  environment?: string;
}

export interface ConversionTimelinePoint extends ConversionTotals {
  start: string;
  end: string;
}

export interface ConversionTimelineResponse extends ApiObject {
  data: ConversionTimelinePoint[];
  interval: string;
  date_range: DateRange;
  environment?: string;
  pagination?: ApiObject;
}

export interface ConversionEventsPagination extends Pagination {
  /** Every event the filters match; sent only with `include_total: true`. */
  total?: number;
}

export interface ConversionEventsResponse extends ApiObject {
  data: ConversionEvent[];
  pagination: ConversionEventsPagination;
  date_range: DateRange;
  environment: string;
}

/**
 * Leads, sales and refunds, and their reports. Writes need
 * `conversions:write`; reads need `conversions:read` and count toward the
 * analytics rate limit. Writes with an `idempotency_key` are retried safely,
 * except `test_mode` writes, which are never retried.
 */
export class ConversionsResource extends Resource {
  /** `POST /conversions/leads`. */
  trackLead(params: TrackLeadParams, options?: RequestOptions): Promise<ConversionWriteResponse> {
    return this.write("/conversions/leads", params, options);
  }

  /** `POST /conversions/leads/validations`: checks without recording. */
  validateLead(params: TrackLeadParams, options?: RequestOptions): Promise<ConversionValidationResponse> {
    return this.write("/conversions/leads/validations", params, options);
  }

  /** `POST /conversions/sales`. */
  trackSale(params: TrackSaleParams, options?: RequestOptions): Promise<ConversionWriteResponse> {
    return this.write("/conversions/sales", params, options);
  }

  /** `POST /conversions/sales/validations`: checks without recording. */
  validateSale(params: TrackSaleParams, options?: RequestOptions): Promise<ConversionValidationResponse> {
    return this.write("/conversions/sales/validations", params, options);
  }

  /** `POST /conversions/refunds`. */
  trackRefund(params: TrackRefundParams, options?: RequestOptions): Promise<ConversionWriteResponse> {
    return this.write("/conversions/refunds", params, options);
  }

  /** `POST /conversions/refunds/validations`: checks without recording. */
  validateRefund(params: TrackRefundParams, options?: RequestOptions): Promise<ConversionValidationResponse> {
    return this.write("/conversions/refunds/validations", params, options);
  }

  /** `GET /conversions/summary`: all-time live totals. */
  summary(query: ConversionSummaryQuery = {}, options?: RequestOptions): Promise<ConversionSummaryResponse> {
    return this.read("/conversions/summary", query, options);
  }

  /** `GET /conversions/attribution`: one row per attribution target. */
  attribution(query: ConversionAttributionQuery = {}, options?: RequestOptions): Promise<ConversionAttributionResponse> {
    return this.read("/conversions/attribution", query, options);
  }

  /** `GET /conversions/timeline`: one point per interval. */
  timeline(query: ConversionTimelineQuery = {}, options?: RequestOptions): Promise<ConversionTimelineResponse> {
    return this.read("/conversions/timeline", query, options);
  }

  /** `GET /conversions/events`: events, newest first. */
  events(query: ConversionEventsQuery = {}, options?: RequestOptions): Promise<ConversionEventsResponse> {
    const { include_total: includeTotal, ...rest } = query;
    // The API counts only for include_total=1.
    return this.read("/conversions/events", includeTotal ? { ...rest, include_total: "1" } : rest, options);
  }

  private write<T>(path: string, params: object, options: RequestOptions | undefined): Promise<T> {
    return this.http.request<T>({ ...requestOptions(options), body: params, method: "POST", path });
  }

  private read<T>(path: string, query: object, options: RequestOptions | undefined): Promise<T> {
    return this.http.request<T>({ ...requestOptions(options), method: "GET", path, query: query as QueryParams });
  }
}
