export function extractApiErrorMessage(err: any, fallback: string): string {
  const apiErrors = err?.error?.errors;
  if (Array.isArray(apiErrors) && apiErrors.length > 0) {
    return apiErrors.map((e: any) => e?.message).filter(Boolean).join(' - ') || fallback;
  }
  return err?.error?.message || fallback;
}
