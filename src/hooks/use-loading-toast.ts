import { toast } from "sonner";

/**
 * Wraps any async operation with a themed loading → success/error toast.
 * Drops the boilerplate of manually calling `toast.loading()`, tracking the
 * id, and swapping it on resolve/reject. The promise is re-thrown so the
 * caller's try/catch still works unchanged.
 *
 * Usage:
 *   const res = await withLoading(
 *     fetch("/api/do-thing", { method: "POST" }).then((r) => r.json()),
 *     { loading: "Saving…", success: "Saved", error: "Save failed" }
 *   );
 */
export function withLoading<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((value: T) => string);
    error?: string | ((err: unknown) => string);
  }
): Promise<T> {
  const id = toast.loading(messages.loading);
  return promise.then(
    (value) => {
      const msg =
        typeof messages.success === "function" ? messages.success(value) : messages.success;
      toast.success(msg, { id });
      return value;
    },
    (err) => {
      const msg =
        typeof messages.error === "function"
          ? messages.error(err)
          : messages.error ??
            (err instanceof Error ? err.message : "Something went wrong");
      toast.error(msg, { id });
      throw err;
    }
  );
}
