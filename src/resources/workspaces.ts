import type { ApiObject, RequestOptions } from "../core/types";
import { Resource, requestOptions, segment } from "./shared";

export interface Workspace extends ApiObject {
  public_id: string;
  name: string;
  slug: string;
  description: string;
  is_personal: boolean;
  /** `false` when archived. */
  active: boolean;
  /** `owner`, `administrator`, `collaborator` or `read_only`. */
  role: string;
  team_count: number;
  member_count: number;
  link_count: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceList extends ApiObject {
  data: Workspace[];
}

export interface WorkspaceResponse extends ApiObject {
  data: Workspace;
}

/** The workspaces the key can reach. Needs `workspaces:read`. */
export class WorkspacesResource extends Resource {
  /** `GET /workspaces`. Not paginated. */
  list(options?: RequestOptions): Promise<WorkspaceList> {
    return this.http.request({ ...requestOptions(options), method: "GET", path: "/workspaces" });
  }

  /** `GET /workspaces/{public_id}`. An archived workspace answers `404`. */
  get(workspacePublicId: string, options?: RequestOptions): Promise<WorkspaceResponse> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: `/workspaces/${segment(workspacePublicId, "workspacePublicId")}`
    });
  }
}
