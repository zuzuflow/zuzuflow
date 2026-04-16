import React from "react";
import { X } from "lucide-react";
import { useCanvasDesignStore, type CanvasTheme } from "../../store/canvasDesignStore";

interface DesignPanelProps {
  onClose: () => void;
}

interface ThemeOptionProps {
  id: CanvasTheme;
  label: string;
  active: boolean;
  onClick: () => void;
  preview: React.ReactNode;
}

function ThemeOption({ label, active, onClick, preview }: ThemeOptionProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
        active
          ? "border-indigo-500 bg-indigo-950/40"
          : "border-border bg-secondary/50 hover:border-border"
      }`}
    >
      <div className="w-full h-16 rounded overflow-hidden border border-border relative">
        {preview}
      </div>
      <span className={`text-xs font-medium ${active ? "text-indigo-300" : "text-muted-foreground"}`}>
        {label}
      </span>
      {active && (
        <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wide">Active</span>
      )}
    </button>
  );
}

export function DesignPanel({ onClose }: DesignPanelProps): React.ReactElement {
  const theme = useCanvasDesignStore((s) => s.theme);
  const setTheme = useCanvasDesignStore((s) => s.setTheme);

  return (
    <div className="absolute right-4 top-14 z-40 w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-foreground">Canvas Design</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="p-4">
        <p className="text-[11px] text-muted-foreground mb-3 font-medium uppercase tracking-wider">Theme</p>
        <div className="flex gap-3">
          <ThemeOption
            id="dark"
            label="Dark"
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
            preview={
              <div className="w-full h-full bg-background flex items-center justify-center gap-1.5 p-2">
                <div className="w-10 h-7 rounded bg-secondary border border-border flex items-center justify-center">
                  <div className="w-5 h-1.5 rounded bg-indigo-600" />
                </div>
                <div className="w-6 h-px bg-slate-600" />
                <div className="w-10 h-7 rounded bg-secondary border border-border flex items-center justify-center">
                  <div className="w-5 h-1.5 rounded bg-emerald-600" />
                </div>
              </div>
            }
          />
          <ThemeOption
            id="bpmn-light"
            label="BPMN Light"
            active={theme === "bpmn-light"}
            onClick={() => setTheme("bpmn-light")}
            preview={
              <div className="w-full h-full bg-slate-100 flex items-center justify-center gap-1.5 p-2">
                <div className="w-10 h-7 rounded bg-white border border-gray-300 shadow-sm flex items-center justify-center">
                  <div className="w-5 h-1.5 rounded bg-indigo-500" />
                </div>
                <div className="w-6 h-px bg-gray-400" />
                <div className="w-10 h-7 rounded bg-white border border-gray-300 shadow-sm flex items-center justify-center">
                  <div className="w-5 h-1.5 rounded bg-emerald-500" />
                </div>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
