// Shared tool-path helper: win32-aware absolute-path detection.
//
// POSIX behavior is identical (leading `/` only). On win32, `C:\…`, `C:/…`,
// and UNC `\\…` also count as absolute; `resolve()` handles the rest.
// POSIX-no-op: no valid POSIX absolute path looks like a drive/UNC prefix,
// so treating those as absolute changes nothing on POSIX.
export function isAbsolutePath(p: string): boolean {
  if (!p) return false;
  if (p.startsWith('/')) return true;
  // Drive-letter absolute: `C:\…` or `C:/…`.
  if (/^[A-Za-z]:[\\/]/.test(p)) return true;
  // UNC: `\\server\share` (or `//server/share` — covered by `/` above,
  // but `\\` needs the explicit check on win32).
  if (p.startsWith('\\\\')) return true;
  return false;
}
