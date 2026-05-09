import { toast } from "sonner";

/**
 * Centralized toast utilities to reduce code duplication
 * across components and server actions
 */

export function showSuccess(message: string, description?: string) {
  toast.success(message, {
    description,
    duration: 3000,
  });
}

export function showError(error: unknown, fallback = "An error occurred") {
  const message =
    error instanceof Error ? error.message : String(error) || fallback;
  toast.error(message, {
    duration: 4000,
  });
}

export function showLoading(message = "Loading...") {
  return toast.loading(message);
}

export function dismissToast(toastId: string | number) {
  toast.dismiss(toastId);
}

export function showInfo(message: string, description?: string) {
  toast(message, {
    description,
    duration: 3000,
  });
}

/**
 * Async toast for long-running operations
 * Usage: await toastAsync(asyncFn(), "Loading...", "Success!", "Error!")
 */
export async function toastAsync<T>(
  promise: Promise<T>,
  loading: string,
  success: string,
  error: string
): Promise<T> {
  return toast.promise(promise, {
    loading,
    success,
    error,
  });
}
