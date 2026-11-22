import type { ApiObject, DateInput, JsonObject, RequestOptions } from "../core/types";
import { Resource, requestOptions, segment } from "./shared";

export interface ListReportRulesParams {
  workspace_public_id?: string | undefined;
  /** `every_x` (scheduled reports) and/or `event` (alerts). */
  schedule_types?: Array<"every_x" | "event" | (string & {})> | undefined;
  link_public_ids?: string[] | undefined;
  team_public_ids?: string[] | undefined;
}

export interface ReportRuleDestination extends ApiObject {
  type: string;
  /** Secrets come back shortened to scheme and host. */
  data: ApiObject;
}

export interface ReportRule extends ApiObject {
  public_id: string;
  name?: string;
  workspace_public_id: string;
  workspace_name?: string;
  team_public_id?: string;
  team_name?: string;
  team_public_ids: string[];
  team_names: string[];
  workspace_wide: boolean;
  /** `every_x` for a scheduled report, `event` for an alert. */
  schedule_type: string;
  schedule_interval_seconds: number | null;
  next_run_at: string | null;
  enabled: boolean;
  trigger_count: number;
  report_name: string;
  report_query_type: string;
  created_at?: string;
  /** Absent when the rule has none. */
  destinations?: ReportRuleDestination[];
  /** Single rule only. */
  definition?: ApiObject;
  include_unassigned_links?: boolean;
}

export interface ReportRuleList extends ApiObject {
  data: ReportRule[];
}

export interface ReportRuleResponse extends ApiObject {
  data: ReportRule;
}

/** A section or alert condition of a `custom_builder.v1` definition. */
export interface ReportDefinitionItem {
  id: string;
  order: number;
  settings: JsonObject;
}

export interface ReportDefinition {
  version: "custom_builder.v1" | (string & {});
  trigger: "scheduled" | "event" | (string & {});
  sections?: ReportDefinitionItem[] | undefined;
  trigger_logic?: "or" | (string & {}) | undefined;
  trigger_conditions?: ReportDefinitionItem[] | undefined;
  context_sections?: ReportDefinitionItem[] | undefined;
  filters?: { tag_public_ids?: string[] | undefined; [key: string]: unknown };
  options?: {
    locale?: string | undefined;
    include_comparison?: boolean | undefined;
    attach_csv?: boolean | undefined;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CreateReportRuleParams {
  /** Required unless the key is restricted to a workspace. */
  workspace_public_id?: string | undefined;
  report_type: "custom_builder_v1" | (string & {});
  schedule_type?: "every_x" | "event" | (string & {}) | undefined;
  /** Required for reports, such as `86400` or `604800`. */
  interval_seconds?: number | undefined;
  initial_run_at?: DateInput | undefined;
  report_name?: string | undefined;
  definition_json: ReportDefinition;
  destination_public_ids?: string[] | undefined;
  team_public_ids?: string[] | undefined;
  include_unassigned_links?: boolean | undefined;
  link_public_ids?: string[] | undefined;
}

/** `PATCH` changes what is sent and keeps the rest. */
export interface UpdateReportRuleParams extends Partial<CreateReportRuleParams> {
  /** `false` pauses the rule; `true` resumes it. */
  enabled?: boolean | undefined;
}

/** Scheduled report and alert rules. Needs `reports:read` / `reports:write`. */
export class ReportsResource extends Resource {
  /** `GET /reports/rules`. */
  listRules(params: ListReportRulesParams = {}, options?: RequestOptions): Promise<ReportRuleList> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: "/reports/rules",
      query: {
        link_public_ids: params.link_public_ids,
        schedule_types: params.schedule_types,
        team_public_ids: params.team_public_ids,
        workspace_public_id: params.workspace_public_id
      }
    });
  }

  /** `GET /reports/rules/{public_id}`. */
  getRule(rulePublicId: string, options?: RequestOptions): Promise<ReportRuleResponse> {
    return this.http.request({
      ...requestOptions(options),
      method: "GET",
      path: `/reports/rules/${segment(rulePublicId, "rulePublicId")}`
    });
  }

  /** `POST /reports/rules`. Answers `201`. */
  createRule(params: CreateReportRuleParams, options?: RequestOptions): Promise<ReportRuleResponse> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "POST",
      path: "/reports/rules"
    });
  }

  /** `PATCH /reports/rules/{public_id}`. */
  updateRule(rulePublicId: string, params: UpdateReportRuleParams, options?: RequestOptions): Promise<ReportRuleResponse> {
    return this.http.request({
      ...requestOptions(options),
      body: params,
      method: "PATCH",
      path: `/reports/rules/${segment(rulePublicId, "rulePublicId")}`
    });
  }

  /** `DELETE /reports/rules/{public_id}`. Answers `204` with no body. */
  async deleteRule(rulePublicId: string, options?: RequestOptions): Promise<void> {
    await this.http.request({
      ...requestOptions(options),
      method: "DELETE",
      path: `/reports/rules/${segment(rulePublicId, "rulePublicId")}`
    });
  }
}
