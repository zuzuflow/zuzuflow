import React, { useState, useEffect } from "react";
import { Bot } from "lucide-react";
import { getAiSettings } from "../../lib/api";
import { AiBuilderPanel } from "./AiBuilderPanel";

/**
 * Floating action button that opens the AI workflow builder panel.
 * Only visible if the org has AI Builder enabled.
 */
export function AiBuilderFab(): React.ReactElement | null {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getAiSettings()
      .then((s) => setEnabled(s.aiBuilderEnabled))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 shadow-lg transition-all hover:scale-105 active:scale-95"
          title="AI Workflow Builder"
        >
          <Bot size={20} />
          <span className="text-sm font-medium">AI Builder</span>
        </button>
      )}

      {/* Panel */}
      {open && <AiBuilderPanel onClose={() => setOpen(false)} />}
    </>
  );
}
