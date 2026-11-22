import type { ApiObject, RequestOptions } from "../core/types";
import { Resource, requestOptions, segment } from "./shared";

export interface UtmTemplate extends ApiObject {
  public_id: string;
  workspace_public_id: string;
  team_public_id: string;
  team_name: string;
  team_public_ids: string[];
  team_names: string[];
  workspace_wide: boolean;
  name: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  utm_id: string;
  created_at: string;
  updated_at: string;
}

export interface ListUtmTemplatesParams {
  /** Add the team templates you can see (sent as `include_team_scoped=1`). */
  include_team_scoped?: boolean | undefined;
  /** Workspace-wide templates plus those assigned to every listed team. */
  team_public_ids?: string[] | undefined;
}

export interface UtmTemplateValues {
  /** Up to 120 characters. Defaults to `Untitled Template`. */
  name?: string | undefined;
  utm_source?: string | undefined;
  utm_medium?: string | undefined;
  utm_campaign?: string | undefined;
  utm_term?: string | undefined;
  utm_content?: string | undefined;
  utm_id?: string | undefined;
  team_public_ids?: string[] | undefined;
}

export type CreateUtmTemplateParams = UtmTemplateValues;

/** `PUT` replaces the template: send every value to keep. */
export interface UpdateUtmTemplateParams extends UtmTemplateValues {
  /** Move the template to another workspace you can edit. */
  workspace_public_id?: string | undefined;
  /** What happens to links the template would no longer reach. */
  lost_access_action?: "remove" | "copy" | (string & {}) | undefined;
}

export interface DeleteUtmTemplateParams {
  /** `keep` (default) leaves the values on the links; `clear` removes them. */
  links?: "keep" | "clear" | (string & {}) | undefined;
}

export interface UtmTemplateList extends ApiObject {
  data: UtmTemplate[];
}

export interface UtmTemplateResponse extends ApiObject {
  data: UtmTemplate;
}

export interface UpdateUtmTemplateResponse extends UtmTemplateResponse {
  move_impact?: ApiObject;
}

export interface DeleteUtmTemplateResponse extends ApiObject {
  data: {
    public_id: string;
    deleted: boolean;
    links: string;
    links_updated: number;
    [key: string]: unknown;
  };
}

/** A workspace's UTM templates. Needs `utm-templates:read` / `utm-templates:write`. */
export class UtmTemplatesResource extends Resource {
  /** `GET /workspaces/{public_id}/utm-templates`. */
  list(workspacePublicId: string, params: ListUtmTemplatesParams = {}, options?: RequestOptions): Promise<UtmTemplateList> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: `/workspaces/${segment(workspacePublicId, "workspacePublicId")}/utm-templates`,
      query: {
        include_team_scoped: params.include_team_scoped === undefined ? undefined : params.include_team_scoped ? "1" : "0",
        team_public_ids: params.team_public_ids
      }
    });
  }

  /** `POST /workspaces/{public_id}/utm-templates`. Answers `201`. */
  create(workspacePublicId: string, params: CreateUtmTemplateParams, options?: RequestOptions): Promise<UtmTemplateResponse> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "POST",
      path: `/workspaces/${segment(workspacePublicId, "workspacePublicId")}/utm-templates`
    });
  }

  /** `PUT /utm-templates/{public_id}`: replaces the template. */
  update(templatePublicId: string, params: UpdateUtmTemplateParams, options?: RequestOptions): Promise<UpdateUtmTemplateResponse> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "PUT",
      path: `/utm-templates/${segment(templatePublicId, "templatePublicId")}`
    });
  }

  /** `DELETE /utm-templates/{public_id}`. */
  delete(templatePublicId: string, params: DeleteUtmTemplateParams = {}, options?: RequestOptions): Promise<DeleteUtmTemplateResponse> {
    return this.http.request({
      ...requestOptions(options),
      method: "DELETE",
      path: `/utm-templates/${segment(templatePublicId, "templatePublicId")}`,
      query: { links: params.links }
    });
  }
}
