/**
 * Generates unique, identifiable names for test-created data.
 * Prefixing with "qa-auto-" makes automated test data easy to spot
 * and safe to bulk-clean manually if a run ever fails mid-cleanup.
 */
export function uniqueName(prefix: string): string {
  const stamp = Date.now().toString(36);
  return `qa-auto-${prefix}-${stamp}`;
}
