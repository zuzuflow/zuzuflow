import React, { useRef } from "react";
import {
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  XCircle,
  Loader2,
  Lock,
  Info,
  Upload,
  FileType,
} from "lucide-react";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import type { PackageTypeResult, PackageTypeStatus } from "@/lib/typeAcquisition";
import { cn } from "@/lib/utils";

interface NpmPackageListProps {
  packages: string[];
  onChange: (packages: string[]) => void;
  /** Per-package resolution status from usePackageTypes */
  packageStatuses: Map<string, PackageTypeResult>;
  /** User-uploaded custom .d.ts content, keyed by package name */
  customTypeDefs?: Record<string, string>;
  /** Called when user uploads a .d.ts for a private package */
  onCustomTypeUpload?: (packageName: string, content: string) => void;
  /** Called when user removes a custom .d.ts */
  onCustomTypeRemove?: (packageName: string) => void;
}

const STATUS_CONFIG: Record<
  PackageTypeStatus,
  { icon: typeof Check; color: string; textColor: string }
> = {
  loading:     { icon: Loader2,        color: "text-muted-foreground", textColor: "text-muted-foreground" },
  loaded:      { icon: Check,           color: "text-emerald-500",     textColor: "text-emerald-500" },
  "no-types":  { icon: AlertTriangle,   color: "text-yellow-500",      textColor: "text-yellow-500" },
  "not-found": { icon: XCircle,         color: "text-red-500",         textColor: "text-red-500" },
  private:     { icon: Lock,            color: "text-blue-400",        textColor: "text-blue-400" },
  error:       { icon: XCircle,         color: "text-red-500",         textColor: "text-red-500" },
};

export function NpmPackageList({
  packages,
  onChange,
  packageStatuses,
  customTypeDefs,
  onCustomTypeUpload,
  onCustomTypeRemove,
}: NpmPackageListProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string>("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onCustomTypeUpload) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      if (content && uploadTargetRef.current) {
        onCustomTypeUpload(uploadTargetRef.current, content);
      }
    };
    reader.readAsText(file);

    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const triggerUpload = (packageName: string) => {
    uploadTargetRef.current = packageName;
    fileInputRef.current?.click();
  };

  return (
    <div>
      <Label>NPM Packages</Label>
      <p className="text-[10px] text-muted-foreground mb-1.5">
        Supports npm packages, scoped packages, and git URLs.
        When packages are specified, code runs in a Node.js child process with{" "}
        <code className="text-muted-foreground">require()</code> available.
      </p>

      {/* Hidden file input for .d.ts uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".d.ts,.ts"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="space-y-1">
        {packages.map((pkg, idx) => {
          const trimmed = pkg.trim();
          const status = trimmed ? packageStatuses.get(trimmed) : undefined;
          const hasCustomTypes = !!(trimmed && customTypeDefs?.[status?.packageName ?? trimmed]);
          const effectiveStatus = hasCustomTypes ? "loaded" : status?.status;

          return (
            <div key={idx}>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Input
                    className="flex-1 font-mono text-xs pr-7"
                    value={pkg}
                    onChange={(e) => {
                      const updated = packages.map((x, i) =>
                        i === idx ? e.target.value : x
                      );
                      onChange(updated);
                    }}
                    placeholder="axios@1.6.0 or git+https://github.com/user/repo.git"
                  />
                  {/* Inline status icon */}
                  {effectiveStatus && effectiveStatus !== "loading" && trimmed && (
                    <span
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2",
                        STATUS_CONFIG[effectiveStatus]?.color ?? "text-muted-foreground"
                      )}
                      title={hasCustomTypes ? "Custom types uploaded" : status?.message}
                    >
                      {React.createElement(
                        STATUS_CONFIG[effectiveStatus]?.icon ?? Info,
                        { size: 12 }
                      )}
                    </span>
                  )}
                  {status?.status === "loading" && trimmed && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" />
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Also clean up custom types for this package
                    if (onCustomTypeRemove && status?.packageName) {
                      onCustomTypeRemove(status.packageName);
                    }
                    onChange(packages.filter((_, i) => i !== idx));
                  }}
                  className="text-muted-foreground hover:text-red-400 shrink-0 p-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Status messages & actions below input */}
              {trimmed && status && status.status !== "loading" && (
                <div className="ml-0.5 mt-0.5">
                  {/* Private package with no custom types → show upload button */}
                  {status.status === "private" && !hasCustomTypes && (
                    <div className="flex items-center gap-2">
                      <div className={cn("flex items-center gap-1", STATUS_CONFIG.private.textColor)}>
                        <Lock size={10} className="shrink-0" />
                        <span className="text-[10px]">{status.message}</span>
                      </div>
                      {onCustomTypeUpload && (
                        <button
                          type="button"
                          onClick={() => triggerUpload(status.packageName)}
                          className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          <Upload size={10} />
                          Upload .d.ts
                        </button>
                      )}
                    </div>
                  )}

                  {/* Private package with custom types uploaded */}
                  {status.status === "private" && hasCustomTypes && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-emerald-500">
                        <FileType size={10} className="shrink-0" />
                        <span className="text-[10px]">Custom types loaded</span>
                      </div>
                      {onCustomTypeRemove && (
                        <button
                          type="button"
                          onClick={() => onCustomTypeRemove(status.packageName)}
                          className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                      {onCustomTypeUpload && (
                        <button
                          type="button"
                          onClick={() => triggerUpload(status.packageName)}
                          className="text-[10px] text-muted-foreground hover:text-indigo-400 transition-colors"
                        >
                          Replace
                        </button>
                      )}
                    </div>
                  )}

                  {/* Not found on npm */}
                  {status.status === "not-found" && (
                    <div className={cn("flex items-center gap-1", STATUS_CONFIG["not-found"].textColor)}>
                      <XCircle size={10} className="shrink-0" />
                      <span className="text-[10px]">{status.message}</span>
                    </div>
                  )}

                  {/* No types available */}
                  {status.status === "no-types" && !hasCustomTypes && (
                    <div className="flex items-center gap-2">
                      <div className={cn("flex items-center gap-1", STATUS_CONFIG["no-types"].textColor)}>
                        <AlertTriangle size={10} className="shrink-0" />
                        <span className="text-[10px]">{status.message}</span>
                      </div>
                      {onCustomTypeUpload && (
                        <button
                          type="button"
                          onClick={() => triggerUpload(status.packageName)}
                          className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          <Upload size={10} />
                          Upload .d.ts
                        </button>
                      )}
                    </div>
                  )}

                  {/* Error */}
                  {status.status === "error" && status.message && (
                    <div className={cn("flex items-center gap-1", STATUS_CONFIG.error.textColor)}>
                      <XCircle size={10} className="shrink-0" />
                      <span className="text-[10px]">{status.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange([...packages, ""])}
        className="flex items-center gap-1 mt-2 text-xs text-indigo-400 hover:text-indigo-300"
      >
        <Plus size={12} /> Add package
      </button>
    </div>
  );
}
