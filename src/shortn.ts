import { ShortnHttpClient } from "./core/http";
import type { ShortnOptions } from "./core/types";
import { AnalyticsResource } from "./resources/analytics";
import { ConversionsResource } from "./resources/conversions";
import { DestinationsResource } from "./resources/destinations";
import { DomainsResource } from "./resources/domains";
import { LinksResource } from "./resources/links";
import { PublicResource } from "./resources/public";
import { ReportsResource } from "./resources/reports";
import { TagsResource } from "./resources/tags";
import { TeamsResource } from "./resources/teams";
import { UtmTemplatesResource } from "./resources/utm-templates";
import { WorkspacesResource } from "./resources/workspaces";

/**
 * Client for the Shortn API (`<baseUrl>/api/v1`).
 *
 * ```ts
 * const shortn = new Shortn({ apiKey: process.env.SHORTN_API_KEY });
 * const { data } = await shortn.workspaces.list();
 * ```
 */
export class Shortn {
  readonly links: LinksResource;
  readonly analytics: AnalyticsResource;
  readonly workspaces: WorkspacesResource;
  readonly tags: TagsResource;
  readonly utmTemplates: UtmTemplatesResource;
  readonly destinations: DestinationsResource;
  readonly teams: TeamsResource;
  readonly domains: DomainsResource;
  readonly reports: ReportsResource;
  readonly conversions: ConversionsResource;
  /** Endpoints that need no API key: `validateUrl`, `qrCode`, `plans`. */
  readonly "public": PublicResource;

  constructor(options: ShortnOptions = {}) {
    const http = new ShortnHttpClient(options);
    this.links = new LinksResource(http);
    this.analytics = new AnalyticsResource(http);
    this.workspaces = new WorkspacesResource(http);
    this.tags = new TagsResource(http);
    this.utmTemplates = new UtmTemplatesResource(http);
    this.destinations = new DestinationsResource(http);
    this.teams = new TeamsResource(http);
    this.domains = new DomainsResource(http);
    this.reports = new ReportsResource(http);
    this.conversions = new ConversionsResource(http);
    this.public = new PublicResource(http);
  }
}
