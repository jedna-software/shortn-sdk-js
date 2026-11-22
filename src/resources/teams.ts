import type { ApiObject, RequestOptions, SuccessResponse } from "../core/types";
import { Resource, requestOptions, segment } from "./shared";

export interface Team extends ApiObject {
  id: number;
  public_id: string;
  name: string;
  slug: string;
  description: string;
  workspace_id: number;
  /** In `get` and `update`. */
  workspace_public_id?: string;
  owner_user_id: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  /** Left out when 0. */
  member_count?: number;
  link_count?: number;
  template_count?: number;
}

export interface TeamList extends ApiObject {
  /** `null` when the workspace has no teams you can see. */
  teams: Team[] | null;
}

export interface CreateTeamParams {
  /** Up to 120 characters. */
  name: string;
  description?: string | undefined;
}

export interface CreatedTeam extends ApiObject {
  id: number;
  slug: string;
  public_id: string;
}

export interface UpdateTeamParams {
  name?: string | undefined;
  description?: string | undefined;
}

/**
 * A slug is unique only within its workspace. When the key reaches several
 * workspaces with the same slug, name the workspace (`?workspace=`).
 */
export interface TeamLookupParams {
  workspace?: string | undefined;
}

/** A workspace's teams, by `slug`. Needs `teams:read` / `teams:write`. */
export class TeamsResource extends Resource {
  /** `GET /workspaces/{public_id}/teams`, newest first. */
  list(workspacePublicId: string, options?: RequestOptions): Promise<TeamList> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: `/workspaces/${segment(workspacePublicId, "workspacePublicId")}/teams`
    });
  }

  /** `POST /workspaces/{public_id}/teams`. The slug is made from the name. */
  create(workspacePublicId: string, params: CreateTeamParams, options?: RequestOptions): Promise<CreatedTeam> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "POST",
      path: `/workspaces/${segment(workspacePublicId, "workspacePublicId")}/teams`
    });
  }

  /** `GET /teams/{slug}`. */
  get(slug: string, params: TeamLookupParams = {}, options?: RequestOptions): Promise<Team> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: `/teams/${segment(slug, "slug")}`,
      query: { workspace: params.workspace }
    });
  }

  /** `PUT /teams/{slug}`: renames or redescribes; the slug stays. */
  update(slug: string, params: UpdateTeamParams, lookup: TeamLookupParams = {}, options?: RequestOptions): Promise<Team> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "PUT",
      path: `/teams/${segment(slug, "slug")}`,
      query: { workspace: lookup.workspace }
    });
  }

  /** `DELETE /teams/{slug}`: archives the team. */
  delete(slug: string, params: TeamLookupParams = {}, options?: RequestOptions): Promise<SuccessResponse> {
    return this.http.request({
      ...requestOptions(options),
      method: "DELETE",
      path: `/teams/${segment(slug, "slug")}`,
      query: { workspace: params.workspace }
    });
  }
}
