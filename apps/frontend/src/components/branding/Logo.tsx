import { Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { container: "w-7 h-7", icon: 14, text: "text-sm" },
  md: { container: "w-9 h-9", icon: 18, text: "text-base" },
  lg: { container: "w-12 h-12", icon: 24, text: "text-xl" },
};

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const s = sizeMap[size];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          s.container,
          "rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20"
        )}
      >
        <Workflow size={s.icon} className="text-white" />
      </div>
      {showText && (
        <span
          className={cn(
            s.text,
            "font-semibold tracking-tight text-foreground"
          )}
        >
          ZuzuFlow
        </span>
      )}
    </div>
  );
}
