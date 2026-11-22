import type {
  ApiObject,
  DateInput,
  ListParams,
  MessageResponse,
  Pagination,
  RequestOptions
} from "../core/types";
import { Resource, requestOptions, segment } from "./shared";

export interface LinkAttributionInput {
  /** `workspace`, `workspace_member`, `team`, `external_partner`, `campaign` or `custom`. */
  type?: "workspace" | "workspace_member" | "team" | "external_partner" | "campaign" | "custom" | (string & {}) | undefined;
  user_public_id?: string | undefined;
  team_public_id?: string | undefined;
  partner_public_id?: string | undefined;
  external_id?: string | undefined;
  label?: string | undefined;
}

export interface ABVariantInput {
  url: string;
  split_percent?: number | undefined;
}

export interface GeoOverrideInput {
  /** `country:<iso>` or `region:<name>`, such as `country:de` or `region:europe`. */
  target: string;
  url: string;
}

/** Body of `POST /links`. Only `url` and `title` are required. */
export interface CreateLinkParams {
  url: string;
  title: string;
  description?: string | undefined;
  custom_code?: string | undefined;
  short_domain?: string | undefined;
  workspace_public_id?: string | undefined;
  team_public_ids?: string[] | undefined;
  /** The older single-team form of `team_public_ids`. */
  team_public_id?: string | undefined;
  tag_public_ids?: string[] | undefined;
  utm_template_id?: string | undefined;
  utm_source?: string | undefined;
  utm_medium?: string | undefined;
  utm_campaign?: string | undefined;
  utm_term?: string | undefined;
  utm_content?: string | undefined;
  utm_id?: string | undefined;
  starts_at?: DateInput | undefined;
  expires_at?: DateInput | undefined;
  expiration_action?: "suspended" | "archive" | (string & {}) | undefined;
  access_mode?: "password" | "jit" | (string & {}) | undefined;
  password?: string | undefined;
  access_duration_hours?: number | undefined;
  jit_allowlist?: string[] | undefined;
  targeting_geo_overrides?: GeoOverrideInput[] | undefined;
  language_targets?: Record<string, string> | undefined;
  device_targets?: Record<string, string> | undefined;
  os_targets?: Record<string, string> | undefined;
  browser_targets?: Record<string, string> | undefined;
  mobile_target_ios?: string | undefined;
  mobile_target_android?: string | undefined;
  targeting_priority?: string[] | undefined;
  ab_variants?: ABVariantInput[] | undefined;
  ab_destination?: string | undefined;
  ab_split_percent?: number | undefined;
  conversion_enabled?: boolean | undefined;
  conversion_attribution_model?: "inherit" | "first_touch" | "last_touch" | (string & {}) | undefined;
  conversion_attribution_window_days?: number | undefined;
  attribution?: LinkAttributionInput | undefined;
  preview_title?: string | undefined;
  preview_description?: string | undefined;
  preview_image?: string | undefined;
  preview_custom?: boolean | undefined;
  cloaking_enabled?: boolean | undefined;
}

/** Answer of `POST /links`. */
export interface CreatedLink extends ApiObject {
  public_id: string;
  short_url: string;
  short_code: string;
  original_url: string;
  title?: string;
  /** `active`, `scheduled` or `security_locked`. */
  link_status?: string;
  security_verdict?: string;
  security_risk_score?: number;
  security_reason_codes?: string[];
  expires_at?: string;
}

export interface LinkTag extends ApiObject {
  public_id: string;
  name: string;
  color: string;
}

export interface Link extends ApiObject {
  public_id: string;
  original_url: string;
  short_code: string;
  /** The link's custom domain; absent for links on the default domain. */
  domain?: string;
  title: string;
  description: string;
  clicks: number;
  active: boolean;
  /** `active`, `scheduled`, `suspended`, `archived` or `security_locked`. */
  status: string;
  /** `clear`, `blocked` or `quarantined`. */
  security_status?: string;
  workspace_public_id?: string;
  /** In lists only. */
  workspace_name?: string;
  tags?: LinkTag[];
  starts_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export type ListLinksParams = ListParams;

export interface LinkList extends ApiObject {
  data: Link[];
  pagination: Pagination;
}

export interface LinkResponse extends ApiObject {
  data: Link;
}

/** Body of `PATCH /links/{public_id}`. Any other field is refused. */
export interface UpdateLinkParams {
  title?: string | undefined;
  description?: string | undefined;
  url?: string | undefined;
  short_code?: string | undefined;
  domain?: string | undefined;
  status?: "active" | "suspended" | "archived" | "scheduled" | (string & {}) | undefined;
  active?: boolean | undefined;
  /** Replace the link's teams; `[]` makes it workspace-wide. Send it alone. */
  team_public_ids?: string[] | undefined;
  /** The older single-team form of `team_public_ids`. */
  team_public_id?: string | undefined;
}

export interface UpdateLinkResponse extends ApiObject {
  message?: string;
  workspace_wide?: boolean;
  team_public_ids?: string[];
  team_names?: string[];
  teams?: ApiObject[];
}

export interface SetAbWinnerParams {
  /** The winner's letter, such as `B`. */
  variant: string;
}

export interface AbWinnerResponse extends ApiObject {
  winner: string;
  test: number;
  destination: string;
}

/** Links, by their `public_id`. Needs `links:read` / `links:write`. */
export class LinksResource extends Resource {
  /** `GET /links`: links, newest first. */
  list(params: ListLinksParams = {}, options?: RequestOptions): Promise<LinkList> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: "/links",
      query: { limit: params.limit, offset: params.offset }
    });
  }

  /** `GET /links/{public_id}`. */
  get(publicId: string, options?: RequestOptions): Promise<LinkResponse> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: `/links/${segment(publicId, "publicId")}`
    });
  }

  /** `POST /links`: creates a link in the key's account. Answers `201`. */
  create(params: CreateLinkParams, options?: RequestOptions): Promise<CreatedLink> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "POST",
      path: "/links"
    });
  }

  /** `PATCH /links/{public_id}`: changes the fields sent. */
  update(publicId: string, params: UpdateLinkParams, options?: RequestOptions): Promise<UpdateLinkResponse> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "PATCH",
      path: `/links/${segment(publicId, "publicId")}`
    });
  }

  /** `DELETE /links/{public_id}`: suspends the link (it stops redirecting; data is kept). */
  delete(publicId: string, options?: RequestOptions): Promise<MessageResponse> {
    return this.http.request({
      ...requestOptions(options),
      method: "DELETE",
      path: `/links/${segment(publicId, "publicId")}`
    });
  }

  /** `POST /links/{public_id}/enable`: makes a suspended link active again. */
  enable(publicId: string, options?: RequestOptions): Promise<MessageResponse> {
    return this.http.request({
      ...requestOptions(options),
      method: "POST",
      path: `/links/${segment(publicId, "publicId")}/enable`
    });
  }

  /** `POST /links/{public_id}/ab/winner`: ends the A/B test with a winner. */
  setAbWinner(publicId: string, params: SetAbWinnerParams, options?: RequestOptions): Promise<AbWinnerResponse> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "POST",
      path: `/links/${segment(publicId, "publicId")}/ab/winner`
    });
  }
}
