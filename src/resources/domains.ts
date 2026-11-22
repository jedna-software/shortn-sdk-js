import type { ApiObject, RequestOptions } from "../core/types";
import { Resource, requestOptions, segment } from "./shared";

export interface DnsRecord extends ApiObject {
  type: string;
  name: string;
  value: string;
  /** Absent when the API suggests none. */
  ttl?: string;
}

export interface Domain extends ApiObject {
  id: number;
  domain: string;
  is_owner?: boolean;
  owner_name?: string;
  can_manage?: boolean;
  access_label?: string;
  /** `ready`, `in_progress`, `not_ready`, `inactive` or `deleting`. */
  status: string;
  dns_status?: string;
  tls_status?: string;
  provisioning_status?: string;
  tls_phase?: string;
  is_active?: boolean;
  is_verified?: boolean;
  ssl_enabled?: boolean;
  ready?: boolean;
  links_using?: number;
  team_assignment_count?: number;
  created_at?: string;
  verified_at?: string;
  verification_token?: string;
  verification_failure_count?: number;
  workspace_public_ids?: string[];
  dns?: {
    verification_txt?: DnsRecord;
    subdomain_cname?: DnsRecord;
    apex_a_records?: DnsRecord[];
    [key: string]: unknown;
  };
}

export interface DomainList extends ApiObject {
  data: Domain[];
}

export interface CreateDomainParams {
  /** A hostname such as `go.example.com`. */
  domain: string;
}

export interface DomainResponse extends ApiObject {
  domain: Domain;
}

export interface DomainVerification extends ApiObject {
  verified: boolean;
  error?: string;
  txt?: ApiObject;
  routing?: ApiObject;
}

export interface VerifyDomainResponse extends DomainResponse {
  verification: DomainVerification;
}

export interface DeleteDomainResponse extends DomainResponse {
  deleted: boolean;
  id: number;
}

/**
 * Custom domains, by numeric `id`. Needs `domains:read` / `domains:write`;
 * create, verify and delete need an account-wide key.
 */
export class DomainsResource extends Resource {
  /** `GET /domains`. */
  list(options?: RequestOptions): Promise<DomainList> {
    return this.http.request({ ...requestOptions(options), method: "GET", path: "/domains" });
  }

  /** `POST /domains`. Answers `201`; then create the DNS records and verify. */
  create(params: CreateDomainParams, options?: RequestOptions): Promise<DomainResponse> {
    return this.http.request({ ...requestOptions(options), body: params, method: "POST", path: "/domains" });
  }

  /** `POST /domains/{id}/verify`: `200` when ready, `202` while being set up. */
  verify(id: number | string, options?: RequestOptions): Promise<VerifyDomainResponse> {
    return this.http.request({
      ...requestOptions(options),
      method: "POST",
      path: `/domains/${segment(id, "id")}/verify`
    });
  }

  /** `DELETE /domains/{id}`. Answers `202` while the domain is removed. */
  delete(id: number | string, options?: RequestOptions): Promise<DeleteDomainResponse> {
    return this.http.request({
      ...requestOptions(options),
      method: "DELETE",
      path: `/domains/${segment(id, "id")}`
    });
  }
}
