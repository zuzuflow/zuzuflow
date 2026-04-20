import React, { useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { saveCurrentWorkflow } from "../../lib/saveWorkflow";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";

/**
 * Intercepts SPA navigation (react-router-dom's `useBlocker`) and browser
 * refresh/tab-close (`beforeunload`) whenever the workflow editor has
 * unsaved changes. Renders nothing on the happy path.
 *
 * Three-way dialog (VSCode / Figma / Notion style):
 *   - Save & leave  — saveCurrentWorkflow(); on success, resume navigation.
 *   - Leave         — discard changes; resume navigation.
 *   - Cancel        — stay on the editor.
 *
 * The browser-level refresh intercept uses the native beforeunload dialog
 * because browsers don't expose a way to render custom UI in that hook.
 */
export function UnsavedChangesGuard(): React.ReactElement | null {
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Intercept in-app navigation whenever the editor is dirty and the user is
  // actually going somewhere different. The function form re-runs on every
  // navigation attempt, so flipping isDirty=false immediately unblocks.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  // Reset any stale save-error when the dialog re-opens for a new navigation.
  useEffect(() => {
    if (blocker.state === "blocked") {
      setSaveError(null);
    }
  }, [blocker.state]);

  // Browser refresh / tab close. beforeunload can't be customised — setting
  // returnValue tells the browser to render its own "Leave site?" prompt.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required by some browsers (Chrome) — the string itself is ignored.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  if (blocker.state !== "blocked") return null;

  async function handleSaveAndLeave() {
    setSaving(true);
    setSaveError(null);
    const result = await saveCurrentWorkflow();
    setSaving(false);
    if (result.ok) {
      blocker.proceed?.();
    } else {
      setSaveError(result.error);
    }
  }

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            Unsaved changes
          </AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes in this workflow. Leaving now will
            discard them.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {saveError && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            Save failed: {saveError}
          </div>
        )}

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => blocker.reset?.()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => blocker.proceed?.()}
            disabled={saving}
          >
            Leave without saving
          </Button>
          <Button onClick={handleSaveAndLeave} disabled={saving}>
            {saving && <Loader2 size={13} className="animate-spin mr-1.5" />}
            Save &amp; leave
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
