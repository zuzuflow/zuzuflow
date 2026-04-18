import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import * as api from "@/lib/api";
import { toast } from "sonner";

interface StatusToggleProps {
  workflowId: string;
  status: string; // "active" | "inactive" | "draft" | "archived"
  /**
   * Called with the new status BEFORE the API request (optimistic) and again
   * with the rolled-back status if the API fails. Parent is responsible for
   * updating its workflows list.
   */
  onOptimisticChange: (nextStatus: string) => void;
}

/**
 * Inline switch for toggling a workflow between active and inactive. Optimistic:
 * flips the UI immediately, rolls back + toasts on API error. Disabled while
 * the request is in flight to prevent double-clicks.
 *
 * Note: this component treats any non-active status as "off". Turning "off"
 * when status is already non-active is a no-op (the switch is already down).
 */
export function StatusToggle({ workflowId, status, onOptimisticChange }: StatusToggleProps) {
  const [pending, setPending] = useState(false);
  const isActive = status === "active";

  async function handleToggle(nextChecked: boolean) {
    // Radix toggles to nextChecked; if it matches current state, skip.
    if (nextChecked === isActive) return;

    setPending(true);
    const prev = status;
    const next = nextChecked ? "active" : "inactive";
    onOptimisticChange(next);
    try {
      if (nextChecked) {
        await api.activateWorkflow(workflowId);
      } else {
        await api.deactivateWorkflow(workflowId);
      }
    } catch (err) {
      onOptimisticChange(prev);
      toast.error(`Failed to ${nextChecked ? "activate" : "deactivate"} workflow`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Switch
      checked={isActive}
      disabled={pending}
      onCheckedChange={handleToggle}
      onClick={(e) => e.stopPropagation()}
      aria-label={isActive ? "Deactivate workflow" : "Activate workflow"}
      className={cn(pending && "opacity-60")}
    />
  );
}
