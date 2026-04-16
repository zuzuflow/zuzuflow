// =============================================================================
// Template interpolation utility
// Resolves {{node_id.field.subfield}} and {{input.field}} patterns against
// a context map of nodeId → output object.
// =============================================================================

/**
 * Resolve a dot-separated path against an object.
 * Returns undefined when any segment is missing.
 */
function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Interpolate all `{{...}}` placeholders in `template`.
 *
 * @param template  - String containing zero or more `{{key.path}}` tokens.
 * @param context   - Flat map where top-level keys are node IDs (or "input").
 *                    Values are the node's output objects.
 *
 * @example
 * interpolateTemplate("Hello {{triggerNode.body.name}}!", {
 *   triggerNode: { body: { name: "World" } },
 * });
 * // => "Hello World!"
 */
export function interpolateTemplate(
  template: string,
  context: Record<string, unknown>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, rawPath: string) => {
    const trimmed = rawPath.trim();

    // Split on the first dot to separate the node/context key from the field path.
    const dotIndex = trimmed.indexOf(".");
    if (dotIndex === -1) {
      // No dot — try to resolve the entire key as a top-level context value.
      const value = context[trimmed];
      return value !== undefined ? String(value) : `{{${rawPath}}}`;
    }

    const contextKey = trimmed.slice(0, dotIndex);
    const fieldPath = trimmed.slice(dotIndex + 1);

    const contextValue = context[contextKey];
    if (contextValue === undefined) {
      // Preserve the original placeholder when the context key is unknown.
      return `{{${rawPath}}}`;
    }

    const resolved = getByPath(contextValue, fieldPath);
    if (resolved === undefined || resolved === null) {
      return `{{${rawPath}}}`;
    }

    // For objects/arrays, serialize to JSON; primitives become strings.
    if (typeof resolved === "object") {
      return JSON.stringify(resolved);
    }
    return String(resolved);
  });
}

/**
 * Deeply interpolate all string values in an object tree.
 * Non-string values are returned as-is; string values are passed through
 * `interpolateTemplate`.
 */
export function interpolateObject(
  obj: unknown,
  context: Record<string, unknown>
): unknown {
  if (typeof obj === "string") {
    return interpolateTemplate(obj, context);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, context));
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateObject(value, context);
    }
    return result;
  }
  return obj;
}
