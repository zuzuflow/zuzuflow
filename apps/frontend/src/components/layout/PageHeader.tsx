import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { slideUp, spring } from "@/lib/motion";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <motion.div
      {...slideUp}
      transition={spring.gentle}
      className="flex items-center justify-between mb-6"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
