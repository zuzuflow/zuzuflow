// =============================================================================
// Lazy loader for isolated-vm — falls back gracefully when the native module
// is not available (e.g., Docker images where it couldn't be compiled).
// =============================================================================

let _ivm: typeof import("isolated-vm") | null = null;
let _loadAttempted = false;

export function getIvm(): typeof import("isolated-vm") | null {
  if (_loadAttempted) return _ivm;
  _loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _ivm = require("isolated-vm");
    console.log("[sandbox] isolated-vm loaded successfully — using in-process sandbox");
  } catch {
    console.warn(
      "[sandbox] isolated-vm not available — JS/TS runner and custom_code will use child-process sandbox (less isolated but functional)"
    );
    _ivm = null;
  }
  return _ivm;
}
