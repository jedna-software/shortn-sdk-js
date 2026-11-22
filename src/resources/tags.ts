import type { ApiObject, RequestOptions } from "../core/types";
import { Resource, requestOptions, segment } from "./shared";

export interface Tag extends ApiObject {
  id: number;
  public_id: string;
  name: string;
  color: string;
  workspace_wide: boolean;
  team_public_ids?: string[];
  team_names?: string[];
  /** Links with this tag that you can see; left out when 0. */
  url_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface ListTagsParams {
  /** Workspace-wide tags plus those assigned to every listed team. */
  team_public_ids?: string[] | undefined;
  /** `none`: only workspace-wide tags. Ignored with `team_public_ids`. */
  team?: "none" | (string & {}) | undefined;
  /** Treat the teams as a report's scope (sent as `report_scope=1`). */
  report_scope?: boolean | undefined;
}

export interface TagList extends ApiObject {
  /** `null` when there are no tags to show. */
  tags: Tag[] | null;
}

export interface CreateTagParams {
  /** 1 to 20 characters. */
  name: string;
  /** Such as `#3b82f6`. */
  color: string;
  team_public_ids?: string[] | undefined;
}

/** Either `name`/`color`, or `team_public_ids`; not both in one request. */
export interface UpdateTagParams {
  name?: string | undefined;
  color?: string | undefined;
  team_public_ids?: string[] | undefined;
}

export interface DeleteTagResponse extends ApiObject {
  message: string;
  links_updated: number;
}

/** A workspace's tags, by `public_id`. Needs `tags:read` / `tags:write`. */
export class TagsResource extends Resource {
  /** `GET /workspaces/{public_id}/tags`, sorted by name. */
  list(workspacePublicId: string, params: ListTagsParams = {}, options?: RequestOptions): Promise<TagList> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: `/workspaces/${segment(workspacePublicId, "workspacePublicId")}/tags`,
      query: {
        report_scope: params.report_scope === undefined ? undefined : params.report_scope ? "1" : "0",
        team: params.team,
        team_public_ids: params.team_public_ids
      }
    });
  }

  /** `POST /workspaces/{public_id}/tags`. Answers `201`. */
  create(workspacePublicId: string, params: CreateTagParams, options?: RequestOptions): Promise<Tag> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "POST",
      path: `/workspaces/${segment(workspacePublicId, "workspacePublicId")}/tags`
    });
  }

  /** `GET /tags/{public_id}`. */
  get(tagPublicId: string, options?: RequestOptions): Promise<Tag> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: `/tags/${segment(tagPublicId, "tagPublicId")}`
    });
  }

  /** `PUT /tags/{public_id}`: changes what is sent, keeps the rest. */
  update(tagPublicId: string, params: UpdateTagParams, options?: RequestOptions): Promise<Tag> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "PUT",
      path: `/tags/${segment(tagPublicId, "tagPublicId")}`
    });
  }

  /** `DELETE /tags/{public_id}`: removes the tag from every link. */
  delete(tagPublicId: string, options?: RequestOptions): Promise<DeleteTagResponse> {
    return this.http.request({
      ...requestOptions(options),
      method: "DELETE",
      path: `/tags/${segment(tagPublicId, "tagPublicId")}`
    });
  }
}
