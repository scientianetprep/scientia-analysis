/**
 * Basic sanitization for admin inputs to prevent accidental HTML injection
 * or malformed strings.
 */
export function sanitizeString(val: any): string {
  if (typeof val !== "string") return "";
  // Strip common HTML tags but allow basic punctuation
  return val
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .trim();
}

/**
 * Recursively sanitize an object's string properties
 */
export function sanitizeObject<T>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  
  const result: any = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    const val = obj[key];
    if (typeof val === "string") {
      result[key] = sanitizeString(val);
    } else if (typeof val === "object" && val !== null) {
      result[key] = sanitizeObject(val);
    } else {
      result[key] = val;
    }
  }
  
  return result as T;
}
