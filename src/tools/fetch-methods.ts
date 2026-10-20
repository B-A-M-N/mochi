// Shared fetch-method hazard classification.
//
// 'fetch' is listed as read-only in three places (agent/loop.ts isReadOnly,
// core/capability-registry.ts READ_ONLY_TOOLS, security/permission.ts
// readTools auto-allow). That classification only holds for GET/HEAD: fetch
// also issues POST/PUT/PATCH/DELETE, which mutate REMOTE state. All consumers
// must agree on which methods stay read-only, so the predicate lives in this
// leaf module — it imports nothing, so no import cycles are possible.

/** HTTP methods that change remote state when sent through the fetch tool. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** True when a tool call mutates remote state via the fetch tool's method
 *  argument. An absent/non-string method defaults to GET (read-only). */
export function isFetchMutationRequest(tool: string, args: Record<string, unknown> | undefined): boolean {
  if (tool !== 'fetch') return false;
  const method = typeof args?.method === 'string' ? args.method.trim().toUpperCase() : '';
  return MUTATING_METHODS.has(method);
}
