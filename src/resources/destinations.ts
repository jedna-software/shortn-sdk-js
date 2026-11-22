import type { ApiObject, RequestOptions, SuccessResponse } from "../core/types";
import { Resource, requestOptions, segment } from "./shared";

export type DestinationType = "email" | "webhook" | "slack" | "discord" | "msteams";

/**
 * `email`: `{to: [...]}` (or a comma-separated string);
 * `webhook`, `slack`, `discord`, `msteams`: `{webhook_url: "https://..."}`.
 */
export interface DestinationConfig {
  to?: string[] | string | undefined;
  webhook_url?: string | undefined;
  [key: string]: unknown;
}

export interface Destination extends ApiObject {
  id: number;
  public_id: string;
  name: string;
  type: DestinationType | (string & {});
  /** Email recipients (comma-separated) or the webhook URL. In lists. */
  value?: string;
  team_public_id?: string;
  team_name?: string;
  team_public_ids: string[];
  team_names: string[];
  workspace_wide: boolean;
  created_at: string;
}

export interface CreateDestinationParams {
  name: string;
  type: DestinationType | (string & {});
  config: DestinationConfig;
  team_public_ids?: string[] | undefined;
}

/** `name` and `type` are required on every update. */
export interface UpdateDestinationParams {
  name: string;
  type: DestinationType | (string & {});
  /** Replaces the configuration; leave it out to keep it. */
  config?: DestinationConfig | undefined;
  /** The complete list of teams; `[]` makes it workspace-wide. */
  team_public_ids?: string[] | undefined;
}

export interface UpdateDestinationResponse extends SuccessResponse {
  workspace_wide?: boolean;
  team_public_ids?: string[];
  team_names?: string[];
  teams?: ApiObject[];
}

/** Where reports and alerts are sent. Needs `destinations:read` / `destinations:write`. */
export class DestinationsResource extends Resource {
  /** `GET /workspaces/{public_id}/destinations`: a bare array. */
  list(workspacePublicId: string, options?: RequestOptions): Promise<Destination[]> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: `/workspaces/${segment(workspacePublicId, "workspacePublicId")}/destinations`
    });
  }

  /** `POST /workspaces/{public_id}/destinations`. Answers `201`. */
  create(workspacePublicId: string, params: CreateDestinationParams, options?: RequestOptions): Promise<Destination> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "POST",
      path: `/workspaces/${segment(workspacePublicId, "workspacePublicId")}/destinations`
    });
  }

  /** `PUT /workspaces/{public_id}/destinations/{destination_public_id}`. */
  update(
    workspacePublicId: string,
    destinationPublicId: string,
    params: UpdateDestinationParams,
    options?: RequestOptions
  ): Promise<UpdateDestinationResponse> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "PUT",
      path: `/workspaces/${segment(workspacePublicId, "workspacePublicId")}/destinations/${segment(destinationPublicId, "destinationPublicId")}`
    });
  }

  /** `DELETE /workspaces/{public_id}/destinations/{destination_public_id}`. */
  delete(workspacePublicId: string, destinationPublicId: string, options?: RequestOptions): Promise<SuccessResponse> {
    return this.http.request({
      ...requestOptions(options),
      method: "DELETE",
      path: `/workspaces/${segment(workspacePublicId, "workspacePublicId")}/destinations/${segment(destinationPublicId, "destinationPublicId")}`
    });
  }
}
