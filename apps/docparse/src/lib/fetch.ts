import { assertPublicUrl, safeFetch } from "@api/core";
import type { SafeFetchOptions } from "@api/core";

/**
 * Thin wrapper over the shared SSRF guard.
 *
 * This module exists so the document input layer keeps a stable local API, but
 * the implementation lives in @api/core: one resolver, one per-hop redirect
 * check, one timeout policy for every app in the workspace.
 */

export async function assertPublicTarget(input: string | URL): Promise<URL> {
  return assertPublicUrl(input);
}

export type GuardedFetchOptions = SafeFetchOptions;

export async function fetchPublicUrl(target: string | URL, options: GuardedFetchOptions = {}): Promise<Response> {
  return safeFetch(target, options);
}
