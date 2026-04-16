# ZuzuFlow UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ZuzuFlow's utilitarian dark-only UI into a modern, polished experience with shadcn/ui components, dual dark/light themes, Raycast-style animations, shared app shell with sidebar navigation, and a Cmd+K command palette.

**Architecture:** Incremental migration -- each task group produces a working, deployable state. shadcn/ui components are code-generated into `src/components/ui/`, styled via CSS custom properties for dual theming. framer-motion handles spring animations. Sonner replaces all alert()/confirm() calls. A new AppShell with sidebar wraps all pages except the full-bleed editor.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS 3.4, shadcn/ui (Radix primitives + CVA), framer-motion, Sonner, cmdk

**Spec:** `docs/superpowers/specs/2026-04-12-ui-overhaul-design.md`

---

## File Structure Overview

### New files to create

```
apps/frontend/
  components.json                              # shadcn CLI config
  src/
    components/
      ui/                                      # shadcn/ui primitives (scaffolded via CLI)
        button.tsx
        input.tsx
        label.tsx
        badge.tsx
        separator.tsx
        switch.tsx
        dialog.tsx
        alert-dialog.tsx
        tabs.tsx
        table.tsx
        dropdown-menu.tsx
        popover.tsx
        tooltip.tsx
        sheet.tsx
        skeleton.tsx
        card.tsx
        command.tsx
        sonner.tsx
      layout/
        AppShell.tsx                           # sidebar + content layout
        Sidebar.tsx                            # left navigation rail
        PageHeader.tsx                         # consistent page header
        CommandPalette.tsx                     # Cmd+K dialog
      theme-provider.tsx                       # dark/light/system theme context
      confirm-dialog.tsx                       # reusable destructive action dialog
      branding/
        Logo.tsx                               # ZuzuFlow logo component
    lib/
      motion.ts                                # framer-motion animation presets
    pages/
      workflows/
        WorkflowsPage.tsx                      # slim orchestrator (replaces monolithic)
        components/
          WorkflowCard.tsx
          FolderTree.tsx
          FolderTreeItem.tsx
          ExecutionHistoryModal.tsx
          MoveWorkflowModal.tsx
          NewWorkflowDialog.tsx
          WorkflowEmptyState.tsx
          WorkflowListSkeleton.tsx
      credentials/
        CredentialsPage.tsx                    # slim orchestrator
        components/
          VariablesPanel.tsx
          CredentialsPanel.tsx
          VariableForm.tsx
          CredentialForm.tsx
          CredentialGroup.tsx
          EmptyCredentials.tsx
          EmptyVariables.tsx
      settings/
        SettingsPage.tsx                       # slim orchestrator
        components/
          GitTab.tsx
          UsersTab.tsx
          ApiTokensTab.tsx
          ChangePasswordModal.tsx
```

### Existing files to modify

```
apps/frontend/
  tsconfig.json                                # add @/* path alias
  vite.config.ts                               # add @/ resolve alias
  tailwind.config.ts                           # CSS variable colors, tailwindcss-animate
  package.json                                 # new dependencies
  src/
    index.css                                  # CSS variable theme layer
    main.tsx                                   # wrap with ThemeProvider + Toaster
    App.tsx                                    # route restructuring for AppShell
    lib/utils.ts                               # (no change needed, cn() already compatible)
    store/canvasDesignStore.ts                  # sync with global theme
    components/
      toolbar/Toolbar.tsx                      # shadcn Button, Tooltip, DropdownMenu
      sidebar/NodePalette.tsx                  # shadcn Input, framer-motion
      panels/PropertiesPanel.tsx               # shadcn Sheet, Input, Select
      panels/ExecutionLog.tsx                  # shadcn Badge, framer-motion
      design/DesignPanel.tsx                   # shadcn Popover
      panels/TemplateInput.tsx                 # wrap shadcn Input internally
      panels/TemplateTextarea.tsx              # wrap shadcn Input internally
      panels/forms/*.tsx                       # 33 files: replace inputClass with shadcn Input/Label
    pages/
      LoginPage.tsx                            # full redesign
      WorkflowsPage.tsx                        # decompose + redesign
      WorkflowEditorPage.tsx                   # layout updates
      CredentialsPage.tsx                      # decompose + redesign
      SettingsPage.tsx                         # decompose + redesign
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `apps/frontend/package.json`

- [ ] **Step 1: Install Radix UI primitives, CVA, animation, and utility packages**

```bash
cd apps/frontend && pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-popover @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-switch @radix-ui/react-alert-dialog @radix-ui/react-slot @radix-ui/react-label class-variance-authority tailwindcss-animate framer-motion cmdk sonner
```

- [ ] **Step 2: Verify installation**

```bash
cd apps/frontend && pnpm build
```

Expected: Build succeeds with no errors (new deps are installed but not yet used).

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/package.json apps/frontend/pnpm-lock.yaml pnpm-lock.yaml
git commit -m "chore: add shadcn/ui, framer-motion, sonner, cmdk dependencies"
```

---

## Task 2: Path Alias Setup

**Files:**
- Modify: `apps/frontend/tsconfig.json`
- Modify: `apps/frontend/vite.config.ts`

- [ ] **Step 1: Add `@/*` path alias to tsconfig.json**

In `apps/frontend/tsconfig.json`, add `@/*` to the existing `paths` object:

```json
"paths": {
  "@/*": ["./src/*"],
  "@workflow/shared": ["../../packages/shared/src"],
  "@workflow/shared/*": ["../../packages/shared/src/*"]
}
```

- [ ] **Step 2: Add `@/` resolve alias to vite.config.ts**

In `apps/frontend/vite.config.ts`, add the `@` alias to the existing `resolve.alias` object:

```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "@workflow/shared": path.resolve(__dirname, "../../packages/shared/src"),
  },
},
```

- [ ] **Step 3: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: Build succeeds. The alias is configured but not yet used by any imports.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/tsconfig.json apps/frontend/vite.config.ts
git commit -m "chore: add @/ path alias for shadcn/ui convention"
```

---

## Task 3: CSS Variable Theme Layer

**Files:**
- Modify: `apps/frontend/src/index.css`

- [ ] **Step 1: Add CSS variable definitions to index.css**

Insert the following `@layer base` block immediately after the three `@tailwind` directives and before the existing `/* CSS custom properties for node category colours */` section:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 238.7 83.5% 66.7%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 238.7 83.5% 66.7%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 217.2 32.6% 11%;
    --card-foreground: 210 40% 98%;
    --popover: 217.2 32.6% 11%;
    --popover-foreground: 210 40% 98%;
    --primary: 238.7 83.5% 66.7%;
    --primary-foreground: 210 40% 98%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 22%;
    --input: 217.2 32.6% 22%;
    --ring: 238.7 83.5% 66.7%;
  }
}
```

- [ ] **Step 2: Update the `body` styles to use CSS variables**

Replace the existing `body` block:

```css
/* Before */
body {
  background-color: #0f172a;
  color: #e2e8f0;
}

/* After */
body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

- [ ] **Step 3: Add `dark` class to index.html**

In `apps/frontend/index.html`, change `<html lang="en">` to `<html lang="en" class="dark">` so the dark theme is active by default (matching current appearance).

- [ ] **Step 4: Verify the app looks identical**

```bash
cd apps/frontend && pnpm dev
```

Open http://localhost:3000 -- the app should look exactly the same as before (dark theme with slate colors). The CSS variables are defined but nothing uses them yet except `body`.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/index.css apps/frontend/index.html
git commit -m "feat: add CSS variable theme layer for dual dark/light theming"
```

---

## Task 4: Update Tailwind Config

**Files:**
- Modify: `apps/frontend/tailwind.config.ts`

- [ ] **Step 1: Rewrite tailwind.config.ts with CSS variable colors and tailwindcss-animate**

Replace the entire content of `apps/frontend/tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Existing custom colors
        brand: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        node: {
          trigger: { bg: "#7c3aed", light: "#ede9fe", border: "#6d28d9" },
          logic: { bg: "#d97706", light: "#fef3c7", border: "#b45309" },
          action: { bg: "#059669", light: "#d1fae5", border: "#047857" },
          code: { bg: "#e11d48", light: "#ffe4e6", border: "#be123c" },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "flow-dash": "flow-dash 1.5s linear infinite",
        "spin-slow": "spin 2s linear infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      keyframes: {
        "flow-dash": {
          to: { strokeDashoffset: "-20" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
    },
  },
  plugins: [tailwindAnimate],
};

export default config;
```

- [ ] **Step 2: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: Build succeeds with no errors. The new Tailwind tokens (e.g., `bg-background`, `text-foreground`, `border-border`) are now available but not yet used outside of the `body` style.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/tailwind.config.ts
git commit -m "feat: update tailwind config with CSS variable tokens and tailwindcss-animate"
```

---

## Task 5: ThemeProvider

**Files:**
- Create: `apps/frontend/src/components/theme-provider.tsx`
- Modify: `apps/frontend/src/main.tsx`

- [ ] **Step 1: Create ThemeProvider component**

Create `apps/frontend/src/components/theme-provider.tsx`:

```typescript
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeProviderState>({
  theme: "dark",
  setTheme: () => null,
});

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "trioflow-theme",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
```

- [ ] **Step 2: Wrap App with ThemeProvider in main.tsx**

Replace `apps/frontend/src/main.tsx`:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/theme-provider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark">
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: Verify the app starts and dark class is applied**

```bash
cd apps/frontend && pnpm dev
```

Open http://localhost:3000 -- app should look identical. Inspect `<html>` element -- it should have `class="dark"`.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/theme-provider.tsx apps/frontend/src/main.tsx
git commit -m "feat: add ThemeProvider with dark/light/system support"
```

---

## Task 6: Create shadcn/ui components.json and Scaffold UI Components

**Files:**
- Create: `apps/frontend/components.json`
- Create: `apps/frontend/src/components/ui/` (directory with ~17 component files)

- [ ] **Step 1: Create components.json**

Create `apps/frontend/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 2: Scaffold all shadcn/ui components via CLI**

Run from `apps/frontend/`:

```bash
cd apps/frontend && npx shadcn@latest add button input label select dialog tabs table badge separator tooltip popover dropdown-menu sheet switch alert-dialog skeleton card --yes
```

If the CLI prompts or fails, manually create the files following shadcn/ui source at https://ui.shadcn.com/docs/components. The key point is that each component file lands in `src/components/ui/`.

- [ ] **Step 3: Install Sonner toast (separate from shadcn scaffold)**

```bash
cd apps/frontend && npx shadcn@latest add sonner --yes
```

This creates `src/components/ui/sonner.tsx` -- a thin wrapper around the `sonner` library's `<Toaster />` component.

- [ ] **Step 4: Scaffold Command component (for cmdk)**

```bash
cd apps/frontend && npx shadcn@latest add command --yes
```

This creates `src/components/ui/command.tsx` wrapping the `cmdk` library.

- [ ] **Step 5: Verify build with all new components**

```bash
cd apps/frontend && pnpm build
```

Expected: Build succeeds. Components are created but not yet imported anywhere.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/components.json apps/frontend/src/components/ui/
git commit -m "feat: scaffold shadcn/ui component library"
```

---

## Task 7: Create Motion Presets

**Files:**
- Create: `apps/frontend/src/lib/motion.ts`

- [ ] **Step 1: Create framer-motion animation presets**

Create `apps/frontend/src/lib/motion.ts`:

```typescript
import type { Transition, Variants } from "framer-motion";

export const spring = {
  gentle: { type: "spring", stiffness: 300, damping: 30 } as Transition,
  snappy: { type: "spring", stiffness: 500, damping: 30 } as Transition,
  bouncy: { type: "spring", stiffness: 400, damping: 20, mass: 0.8 } as Transition,
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const slideUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
};

export const slideRight = {
  initial: { x: "100%" },
  animate: { x: 0 },
  exit: { x: "100%" },
};

export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/lib/motion.ts
git commit -m "feat: add framer-motion animation presets"
```

---

## Task 8: Add Sonner Toaster to App

**Files:**
- Modify: `apps/frontend/src/main.tsx`

- [ ] **Step 1: Add Toaster component to main.tsx**

Update `apps/frontend/src/main.tsx` to include the Sonner Toaster:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark">
      <App />
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  </React.StrictMode>
);
```

Note: If the `@/` import doesn't work with the Toaster import in main.tsx (since main.tsx is the entry point), use the relative path: `"./components/ui/sonner"`.

- [ ] **Step 2: Verify toast renders**

```bash
cd apps/frontend && pnpm dev
```

Expected: App starts. No visible toast yet, but the `<Toaster>` is mounted. No console errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/main.tsx
git commit -m "feat: mount Sonner toaster for notification system"
```

---

## Task 9: Create ConfirmDialog Component

**Files:**
- Create: `apps/frontend/src/components/confirm-dialog.tsx`

- [ ] **Step 1: Create reusable ConfirmDialog wrapping AlertDialog**

Create `apps/frontend/src/components/confirm-dialog.tsx`:

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  destructive = true,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/confirm-dialog.tsx
git commit -m "feat: add reusable ConfirmDialog component"
```

---

## Task 10: Create Logo Component

**Files:**
- Create: `apps/frontend/src/components/branding/Logo.tsx`

- [ ] **Step 1: Create ZuzuFlow logo component**

Create `apps/frontend/src/components/branding/Logo.tsx`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/branding/Logo.tsx
git commit -m "feat: add ZuzuFlow logo component"
```

---

## Task 11: Create PageHeader Component

**Files:**
- Create: `apps/frontend/src/components/layout/PageHeader.tsx`

- [ ] **Step 1: Create consistent page header**

Create `apps/frontend/src/components/layout/PageHeader.tsx`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/layout/PageHeader.tsx
git commit -m "feat: add PageHeader component with motion animation"
```

---

## Task 12: Create AppShell with Sidebar

**Files:**
- Create: `apps/frontend/src/components/layout/Sidebar.tsx`
- Create: `apps/frontend/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Create Sidebar component**

Create `apps/frontend/src/components/layout/Sidebar.tsx`:

```typescript
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  KeyRound,
  Settings,
  Sun,
  Moon,
  LogOut,
  Command,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/branding/Logo";
import { useTheme } from "@/components/theme-provider";
import { useApiConfigStore } from "@/store/apiConfigStore";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { to: "/", icon: LayoutGrid, label: "Workflows" },
  { to: "/credentials", icon: KeyRound, label: "Credentials" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  onOpenCommandPalette?: () => void;
}

export function Sidebar({ onOpenCommandPalette }: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const { theme, setTheme } = useTheme();
  const logout = useApiConfigStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        animate={{ width: expanded ? 240 : 56 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="h-full bg-card/80 backdrop-blur-xl border-r border-border flex flex-col overflow-hidden shrink-0"
      >
        {/* Header */}
        <div className="h-14 flex items-center px-3 gap-2 shrink-0">
          <Logo size="sm" showText={expanded} />
          <div className="flex-1" />
          {expanded && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpanded(false)}
            >
              <PanelLeftClose size={14} />
            </Button>
          )}
        </div>

        {!expanded && (
          <div className="px-3 mb-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 w-full"
              onClick={() => setExpanded(true)}
            >
              <PanelLeft size={14} />
            </Button>
          </div>
        )}

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2 space-y-1">
          {navItems.map((item) => (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors relative",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full"
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                          }}
                        />
                      )}
                      <item.icon size={18} className="shrink-0" />
                      <AnimatePresence>
                        {expanded && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="truncate"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </NavLink>
              </TooltipTrigger>
              {!expanded && (
                <TooltipContent side="right">{item.label}</TooltipContent>
              )}
            </Tooltip>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-2 pb-3 space-y-1">
          <Separator className="mb-2" />

          {/* Command palette hint */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 px-2.5 py-2 h-auto text-muted-foreground",
                  !expanded && "justify-center px-0"
                )}
                onClick={onOpenCommandPalette}
              >
                <Command size={18} className="shrink-0" />
                {expanded && (
                  <span className="text-sm">
                    Search
                    <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                      {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+K
                    </kbd>
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            {!expanded && (
              <TooltipContent side="right">Search (Cmd+K)</TooltipContent>
            )}
          </Tooltip>

          {/* Theme toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 px-2.5 py-2 h-auto text-muted-foreground",
                  !expanded && "justify-center px-0"
                )}
                onClick={toggleTheme}
              >
                {theme === "dark" ? (
                  <Sun size={18} className="shrink-0" />
                ) : (
                  <Moon size={18} className="shrink-0" />
                )}
                {expanded && (
                  <span className="text-sm">
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            {!expanded && (
              <TooltipContent side="right">Toggle theme</TooltipContent>
            )}
          </Tooltip>

          {/* Logout */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 px-2.5 py-2 h-auto text-muted-foreground",
                  !expanded && "justify-center px-0"
                )}
                onClick={handleLogout}
              >
                <LogOut size={18} className="shrink-0" />
                {expanded && <span className="text-sm">Logout</span>}
              </Button>
            </TooltipTrigger>
            {!expanded && (
              <TooltipContent side="right">Logout</TooltipContent>
            )}
          </Tooltip>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Create AppShell layout component**

Create `apps/frontend/src/components/layout/AppShell.tsx`:

```typescript
import { useState, useCallback, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";

export function AppShell() {
  const [commandOpen, setCommandOpen] = useState(false);

  const handleOpenCommandPalette = useCallback(() => {
    setCommandOpen(true);
  }, []);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar onOpenCommandPalette={handleOpenCommandPalette} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/layout/Sidebar.tsx apps/frontend/src/components/layout/AppShell.tsx
git commit -m "feat: add AppShell with collapsible sidebar and global keyboard shortcuts"
```

---

## Task 13: Create Command Palette

**Files:**
- Create: `apps/frontend/src/components/layout/CommandPalette.tsx`

- [ ] **Step 1: Create CommandPalette component**

Create `apps/frontend/src/components/layout/CommandPalette.tsx`:

```typescript
import { useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  KeyRound,
  Settings,
  Plus,
  Sun,
  Moon,
  LogOut,
  GitFork,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useTheme } from "@/components/theme-provider";
import { useApiConfigStore } from "@/store/apiConfigStore";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const logout = useApiConfigStore((s) => s.logout);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <LayoutGrid size={16} className="mr-2" />
            Workflows
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/credentials"))}
          >
            <KeyRound size={16} className="mr-2" />
            Credentials
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/settings"))}
          >
            <Settings size={16} className="mr-2" />
            Settings
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => runCommand(() => navigate("/editor/new"))}
          >
            <Plus size={16} className="mr-2" />
            New Workflow
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => navigate("/editor/new?subworkflow=true"))
            }
          >
            <GitFork size={16} className="mr-2" />
            New Subworkflow
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() =>
                setTheme(theme === "dark" ? "light" : "dark")
              )
            }
          >
            {theme === "dark" ? (
              <Sun size={16} className="mr-2" />
            ) : (
              <Moon size={16} className="mr-2" />
            )}
            Toggle Theme
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                logout();
                navigate("/login");
              })
            }
          >
            <LogOut size={16} className="mr-2" />
            Logout
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/layout/CommandPalette.tsx
git commit -m "feat: add Cmd+K command palette with navigation and actions"
```

---

## Task 14: Restructure App.tsx Routes for AppShell

**Files:**
- Modify: `apps/frontend/src/App.tsx`

- [ ] **Step 1: Update App.tsx to use AppShell layout for shell pages**

Replace `apps/frontend/src/App.tsx`:

```typescript
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useApiConfigStore } from "./store/apiConfigStore";
import { AppShell } from "./components/layout/AppShell";
import { WorkflowsPage } from "./pages/WorkflowsPage";
import { WorkflowEditorPage } from "./pages/WorkflowEditorPage";
import { CredentialsPage } from "./pages/CredentialsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LoginPage } from "./pages/LoginPage";

function AuthGuard({ children }: { children: React.ReactElement }): React.ReactElement {
  const isAuthenticated = useApiConfigStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected with sidebar shell */}
        <Route
          element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }
        >
          <Route path="/" element={<WorkflowsPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Protected full-bleed (no sidebar) */}
        <Route
          path="/editor/:id"
          element={
            <AuthGuard>
              <WorkflowEditorPage />
            </AuthGuard>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Verify all routes work**

```bash
cd apps/frontend && pnpm dev
```

Navigate to:
- http://localhost:3000/ -- should show WorkflowsPage inside AppShell (sidebar + content)
- http://localhost:3000/credentials -- CredentialsPage inside AppShell
- http://localhost:3000/settings -- SettingsPage inside AppShell
- http://localhost:3000/editor/new -- WorkflowEditorPage full-bleed (no sidebar)
- http://localhost:3000/login -- LoginPage (no sidebar)

Note: The existing pages still have their own top bars. These will be removed in subsequent tasks. For now, having both the sidebar AND the existing per-page headers is expected and temporary.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/App.tsx
git commit -m "feat: restructure routes to use AppShell layout with sidebar"
```

---

## Task 15: Replace alert()/confirm() Calls with Toast and ConfirmDialog

**Files:**
- Modify: `apps/frontend/src/pages/WorkflowsPage.tsx`
- Modify: `apps/frontend/src/pages/CredentialsPage.tsx`
- Modify: `apps/frontend/src/pages/SettingsPage.tsx`
- Modify: `apps/frontend/src/components/toolbar/Toolbar.tsx`

This task is mechanical. For each file:
1. Add `import { toast } from "sonner"` at the top
2. Add `import { ConfirmDialog } from "@/components/confirm-dialog"` (or relative path)
3. Replace `alert(String(err))` with `toast.error(err.message || "Operation failed")`
4. Replace `confirm("...")` patterns with a state-managed `<ConfirmDialog>` component

- [ ] **Step 1: Replace alerts in WorkflowsPage.tsx**

At the top of WorkflowsPage.tsx, add:
```typescript
import { toast } from "sonner";
```

Then replace all `alert(...)` calls with `toast.error(...)`. For example:
```typescript
// Before:
} catch (err) { alert(String(err)); }

// After:
} catch (err) { toast.error((err as Error).message || "Operation failed"); }
```

For each `confirm()` call, convert to a ConfirmDialog pattern. Add a state variable like:
```typescript
const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
```

Replace the inline `confirm()` with setting the state:
```typescript
// Before:
const handleDeleteWorkflow = async (wf: WorkflowListItem) => {
  if (!confirm(`Delete "${wf.name}"?`)) return;
  // ... delete logic
};

// After:
const handleDeleteWorkflow = (wf: WorkflowListItem) => {
  setDeleteTarget({ id: wf.id, name: wf.name });
};

const confirmDelete = async () => {
  if (!deleteTarget) return;
  try {
    await api.deleteWorkflow(deleteTarget.id);
    toast.success("Workflow deleted");
    load();
  } catch (err) {
    toast.error((err as Error).message || "Delete failed");
  } finally {
    setDeleteTarget(null);
  }
};
```

And render the dialog:
```tsx
<ConfirmDialog
  open={!!deleteTarget}
  onOpenChange={(open) => !open && setDeleteTarget(null)}
  title="Delete workflow"
  description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
  confirmLabel="Delete"
  onConfirm={confirmDelete}
/>
```

Apply the same pattern for folder deletion and any other `confirm()` calls.

- [ ] **Step 2: Replace alerts in CredentialsPage.tsx**

Same approach: add `toast` import, replace `alert()` with `toast.error()`, convert `confirm()` to `ConfirmDialog` for credential and variable deletion.

- [ ] **Step 3: Replace alerts in SettingsPage.tsx**

Same approach for user deletion (`handleDelete` in UsersTab) and token revocation (`handleRevoke` in ApiTokensTab).

- [ ] **Step 4: Replace alert in Toolbar.tsx**

In Toolbar.tsx, the import failure:
```typescript
// Before:
alert(`Import failed: ${String(err)}`);

// After:
toast.error(`Import failed: ${(err as Error).message || "Unknown error"}`);
```

Add `import { toast } from "sonner"` at the top of Toolbar.tsx.

- [ ] **Step 5: Verify no alert() or confirm() calls remain**

```bash
cd apps/frontend && grep -rn "alert(" src/ --include="*.tsx" --include="*.ts" | grep -v "AlertDialog" | grep -v "alert-dialog"
cd apps/frontend && grep -rn "confirm(" src/ --include="*.tsx" --include="*.ts"
```

Expected: No results (all replaced).

- [ ] **Step 6: Test toast notifications**

```bash
cd apps/frontend && pnpm dev
```

Trigger an error action (e.g., try to delete a workflow) -- should see a toast notification in the bottom-right corner instead of a browser alert.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/pages/WorkflowsPage.tsx apps/frontend/src/pages/CredentialsPage.tsx apps/frontend/src/pages/SettingsPage.tsx apps/frontend/src/components/toolbar/Toolbar.tsx
git commit -m "feat: replace all alert/confirm with toast notifications and ConfirmDialog"
```

---

## Task 16: Migrate LoginPage to Polished Design

**Files:**
- Modify: `apps/frontend/src/pages/LoginPage.tsx`

- [ ] **Step 1: Rewrite LoginPage with two-column layout, shadcn components, and animations**

Replace the entire content of `apps/frontend/src/pages/LoginPage.tsx`:

```typescript
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/branding/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "../lib/api";
import { spring } from "@/lib/motion";

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) { setError("Username is required"); return; }
    if (!password.trim()) { setError("Password is required"); return; }
    setLoading(true);
    try {
      await login(username.trim(), password.trim());
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error).message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left branding panel -- hidden on mobile */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring.gentle}
        >
          <Logo size="lg" className="mb-6" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.gentle, delay: 0.1 }}
          className="text-lg text-muted-foreground max-w-sm text-center"
        >
          Visual workflow automation for teams that ship fast
        </motion.p>

        {/* Decorative floating shapes */}
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-20 h-20 rounded-2xl bg-primary/5 border border-primary/10"
        />
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-1/3 right-1/4 w-16 h-16 rounded-xl bg-primary/5 border border-primary/10"
        />
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-1/3 right-1/3 w-12 h-12 rounded-lg bg-primary/5 border border-primary/10"
        />
      </div>

      {/* Right form panel */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={spring.gentle}
        className="flex-1 flex items-center justify-center px-6"
      >
        <div className="w-full max-w-sm">
          {/* Logo for mobile only */}
          <div className="md:hidden flex justify-center mb-8">
            <Logo size="md" />
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <h1 className="text-base font-semibold text-foreground">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Sign in to your account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </form>

            <div className="px-6 py-4 border-t border-border">
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleSubmit as React.MouseEventHandler}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin mr-2" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <LogIn size={14} className="mr-2" />
                      Sign in
                    </>
                  )}
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Verify login page**

```bash
cd apps/frontend && pnpm dev
```

Navigate to http://localhost:3000/login -- should see two-column layout on desktop, form on the right, logo + tagline + floating shapes on the left.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/LoginPage.tsx
git commit -m "feat: redesign LoginPage with two-column layout, shadcn components, and animations"
```

---

## Task 17: Remove Per-Page Top Bars from Shell Pages

**Files:**
- Modify: `apps/frontend/src/pages/WorkflowsPage.tsx`
- Modify: `apps/frontend/src/pages/CredentialsPage.tsx`
- Modify: `apps/frontend/src/pages/SettingsPage.tsx`

Now that the AppShell provides navigation, remove the custom top bars from each page. Each page should start with its content directly (wrapped in a container div), using the shared `PageHeader` component.

- [ ] **Step 1: Update WorkflowsPage**

Remove the top bar `<div>` that contains the back arrow + logo + "Workflow Automation" text + Credentials/Settings links. Replace with a PageHeader. The page should render in the AppShell's `<main>` area, so use padding: `px-8 py-6`.

Add to imports:
```typescript
import { PageHeader } from "@/components/layout/PageHeader";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
```

Replace the top bar with:
```tsx
<PageHeader
  icon={LayoutGrid}
  title="Workflows"
  description={`${workflows.length} workflow${workflows.length !== 1 ? "s" : ""}`}
  actions={
    <Button onClick={() => setShowNewDialog(true)} size="sm">
      <Plus size={14} className="mr-1.5" />
      New Workflow
    </Button>
  }
/>
```

Remove the wrapping `min-h-screen` class -- the AppShell handles full-height. Change the outer div to:
```tsx
<div className="px-8 py-6">
```

- [ ] **Step 2: Update CredentialsPage**

Remove the `border-b border-slate-800 px-8 py-4` top bar and the per-page tabs `border-b` bar. Replace with:
```tsx
<div className="px-8 py-6 max-w-4xl mx-auto">
  <PageHeader icon={KeyRound} title="Secrets & Variables" />
  {/* ... existing tabs and content */}
</div>
```

Remove `min-h-screen bg-slate-950 text-slate-200` from the outer div (AppShell provides bg).

- [ ] **Step 3: Update SettingsPage**

Same pattern -- remove top bar, replace with PageHeader:
```tsx
<div className="px-8 py-6 max-w-2xl">
  <PageHeader icon={Settings} title="Settings" />
  {/* ... existing tabs and content */}
</div>
```

Remove `min-h-screen bg-slate-950 text-slate-200`.

- [ ] **Step 4: Verify all three pages look correct in the shell**

```bash
cd apps/frontend && pnpm dev
```

Navigate to each page -- should have the sidebar on the left and the page content with a consistent header.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/WorkflowsPage.tsx apps/frontend/src/pages/CredentialsPage.tsx apps/frontend/src/pages/SettingsPage.tsx
git commit -m "feat: remove per-page top bars, use PageHeader inside AppShell"
```

---

## Task 18: Migrate Toolbar to shadcn Components

**Files:**
- Modify: `apps/frontend/src/components/toolbar/Toolbar.tsx`

- [ ] **Step 1: Replace inline button styles with shadcn Button + Tooltip**

Add imports:
```typescript
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
```

Replace:
1. All inline button classNames with `<Button variant="..." size="sm">` or `<Button variant="ghost" size="icon">`
2. The export dropdown with `<DropdownMenu>` + `<DropdownMenuTrigger>` + `<DropdownMenuContent>` + `<DropdownMenuItem>`
3. `<div className="h-5 w-px bg-slate-700" />` separators with `<Separator orientation="vertical" className="h-5" />`
4. Add `<Tooltip>` wrappers around icon-only buttons (back, import, design palette)
5. Update the outer toolbar div class to: `"absolute top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border"`

For the Save button with animated states, use shadcn Button:
```tsx
<Button
  onClick={handleSave}
  disabled={saveState === "saving"}
  variant={saveState === "saved" ? "default" : saveState === "error" ? "destructive" : "secondary"}
  size="sm"
>
  {saveState === "saving" ? <Loader2 size={13} className="animate-spin mr-1.5" />
    : saveState === "saved" ? <CheckCircle2 size={13} className="mr-1.5" />
    : <Save size={13} className="mr-1.5" />}
  {saveButtonLabel}
</Button>
```

For the Run button (primary action):
```tsx
<Button onClick={handleRun} disabled={isRunning} size="sm">
  {isRunning ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Zap size={13} className="mr-1.5" />}
  {hasCronTrigger ? "Test Run" : "Run"}
</Button>
```

- [ ] **Step 2: Wrap Toolbar content in TooltipProvider**

Wrap the entire toolbar return value in `<TooltipProvider delayDuration={0}>`.

- [ ] **Step 3: Verify toolbar**

```bash
cd apps/frontend && pnpm dev
```

Navigate to editor -- toolbar should use glass effect, grouped buttons with separators, proper tooltips on hover, dropdown for export.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/toolbar/Toolbar.tsx
git commit -m "feat: migrate Toolbar to shadcn Button, Tooltip, DropdownMenu, Separator"
```

---

## Task 19: Migrate NodePalette with Animations

**Files:**
- Modify: `apps/frontend/src/components/sidebar/NodePalette.tsx`

- [ ] **Step 1: Add shadcn Input and framer-motion**

Add imports:
```typescript
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { spring } from "@/lib/motion";
```

Replace the search `<input>` with shadcn `<Input>`:
```tsx
<Input
  type="text"
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  placeholder="Search nodes..."
  className="pl-7"
/>
```

- [ ] **Step 2: Add expand/collapse animation to CategorySection**

Wrap the category content in `AnimatePresence` + `motion.div`:
```tsx
<AnimatePresence initial={false}>
  {!collapsed && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={spring.gentle}
      className="overflow-hidden"
    >
      <div className="space-y-0.5 px-2 pb-1">
        {kinds.map((kind) => (
          <PaletteItem key={kind} kind={kind} />
        ))}
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 3: Add hover lift to PaletteItem**

Wrap PaletteItem's outer div with `motion.div`:
```tsx
<motion.div
  whileHover={{ x: 2 }}
  transition={spring.gentle}
  draggable
  onDragStart={handleDragStart}
  className="flex items-start gap-2.5 px-3 py-2 rounded-md cursor-grab active:cursor-grabbing transition-colors hover:bg-accent border-l-2"
  style={{ borderLeftColor: entry.color }}
>
```

- [ ] **Step 4: Update sidebar background to theme-aware**

Change the `<aside>` className:
```tsx
<aside className="w-64 h-full bg-card border-r border-border flex flex-col overflow-hidden">
```

- [ ] **Step 5: Verify**

```bash
cd apps/frontend && pnpm dev
```

Open editor, verify node palette has smooth expand/collapse, hover lift on items, themed background.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/sidebar/NodePalette.tsx
git commit -m "feat: add animations to NodePalette with shadcn Input"
```

---

## Task 20: Migrate Node Form Files (Batch)

**Files:**
- Modify: All 33 files in `apps/frontend/src/components/panels/forms/`

This is a mechanical migration. Each form file independently defines an `inputClass` constant and uses raw `<input>`, `<select>`, `<textarea>`, and `<label>` elements.

- [ ] **Step 1: Pattern to apply in each file**

For each of the 33 form files:

1. Add imports at the top:
```typescript
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

2. Remove the `inputClass` constant (if present).

3. Replace `<input className={inputClass} ...>` with `<Input ...>` (remove className).

4. Replace `<label className="block text-xs font-medium text-slate-400 mb-1">` with `<Label>`.

5. Replace `<select className={inputClass} ...>` with `<select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" ...>`. (Or use shadcn Select if the form uses a simple select.)

6. Replace `<textarea className={inputClass} ...>` with `<textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" ...>`.

**Important**: Forms that use `<TemplateInput>` or `<TemplateTextarea>` should NOT have those replaced -- only raw HTML elements get replaced.

- [ ] **Step 2: Apply to all 33 files**

Files to modify (all in `apps/frontend/src/components/panels/forms/`):
```
Base64Form.tsx CronForm.tsx CryptoHashForm.tsx CustomCodeForm.tsx
DataMapperForm.tsx DateFormatterForm.tsx DelayForm.tsx HtmlTemplateForm.tsx
HttpRequestForm.tsx IfElseForm.tsx JsRunnerForm.tsx JsonParserForm.tsx
LlmPromptForm.tsx MergeForm.tsx MongodbForm.tsx MqttForm.tsx
MysqlForm.tsx PostgresForm.tsx RabbitMQForm.tsx RedisForm.tsx
S3BucketForm.tsx SendEmailForm.tsx SlackForm.tsx SshTerminalForm.tsx
StopForm.tsx SubflowOutputForm.tsx SubworkflowCallForm.tsx SwitchForm.tsx
TwilioEmailForm.tsx TwilioSmsForm.tsx WebhookForm.tsx
WorkflowTriggerInForm.tsx WorkflowTriggerOutForm.tsx
```

- [ ] **Step 3: Verify build and forms render correctly**

```bash
cd apps/frontend && pnpm build
```

Then `pnpm dev` and open a workflow editor -- click on various node types to ensure their property forms render correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/panels/forms/
git commit -m "feat: migrate all 33 node form files to shadcn Input and Label"
```

---

## Task 21: Migrate ExecutionLog with Badge and Animation

**Files:**
- Modify: `apps/frontend/src/components/panels/ExecutionLog.tsx`

- [ ] **Step 1: Add shadcn Badge and framer-motion**

Add imports:
```typescript
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { spring } from "@/lib/motion";
```

Replace inline status color classes with Badge variants:
```tsx
// Before:
<span className={cn("text-xs font-semibold", statusColor[status])}>
  {status}
</span>

// After:
<Badge variant={status === "completed" ? "default" : status === "failed" ? "destructive" : "secondary"}>
  {status}
</Badge>
```

- [ ] **Step 2: Add slide-up animation for the execution drawer**

Wrap the execution log drawer content in a `motion.div`:
```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 192, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={spring.snappy}
      className="border-t border-border bg-card overflow-hidden"
    >
      {/* ... existing drawer content */}
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 3: Update background colors to theme tokens**

Replace `bg-slate-900`, `border-slate-700`, `text-slate-400` etc. with `bg-card`, `border-border`, `text-muted-foreground`.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/panels/ExecutionLog.tsx
git commit -m "feat: add Badge and slide animation to ExecutionLog"
```

---

## Task 22: Migrate PropertiesPanel with Slide-in Animation

**Files:**
- Modify: `apps/frontend/src/components/panels/PropertiesPanel.tsx`
- Modify: `apps/frontend/src/pages/WorkflowEditorPage.tsx`

- [ ] **Step 1: Add framer-motion slide-in to PropertiesPanel**

At the top of PropertiesPanel.tsx:
```typescript
import { motion } from "framer-motion";
import { spring } from "@/lib/motion";
```

Wrap the panel's outermost `<aside>` or `<div>` in:
```tsx
<motion.aside
  initial={{ x: 50, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: 50, opacity: 0 }}
  transition={spring.snappy}
  className="w-[360px] h-full bg-card border-l border-border flex flex-col overflow-hidden"
>
```

Update hardcoded `bg-slate-900 border-slate-700` to `bg-card border-border`.

- [ ] **Step 2: Wrap with AnimatePresence in WorkflowEditorPage**

In WorkflowEditorPage.tsx, wrap the PropertiesPanel render:
```tsx
import { AnimatePresence } from "framer-motion";

// In the JSX:
<AnimatePresence>
  {(selectedNodeId || selectedEdgeId) && <PropertiesPanel />}
</AnimatePresence>
```

- [ ] **Step 3: Verify the panel slides in/out**

Open a workflow, click a node -- panel should slide in from the right. Click elsewhere to deselect -- panel should slide out.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/panels/PropertiesPanel.tsx apps/frontend/src/pages/WorkflowEditorPage.tsx
git commit -m "feat: add slide-in animation to PropertiesPanel"
```

---

## Task 23: Migrate SettingsPage Tabs to shadcn

**Files:**
- Modify: `apps/frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Replace custom tab bar with shadcn Tabs**

Add imports:
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
```

Replace the custom tab state management and rendering:
```tsx
// Before: manual tab state + button group
const [tab, setTab] = useState<Tab>("git");

// After: use shadcn Tabs (manages its own state)
<Tabs defaultValue="git" className="w-full">
  <TabsList>
    <TabsTrigger value="git">
      <GitBranch size={13} className="mr-1.5" />
      Git Integration
    </TabsTrigger>
    <TabsTrigger value="users">
      <Users size={13} className="mr-1.5" />
      Users
    </TabsTrigger>
    <TabsTrigger value="tokens">
      <Key size={13} className="mr-1.5" />
      API Tokens
    </TabsTrigger>
  </TabsList>
  <TabsContent value="git"><GitTab /></TabsContent>
  <TabsContent value="users"><UsersTab /></TabsContent>
  <TabsContent value="tokens"><ApiTokensTab /></TabsContent>
</Tabs>
```

- [ ] **Step 2: Update background colors to theme tokens**

Replace hardcoded `bg-slate-900 border-slate-800` with `bg-card border-border` throughout the file.

- [ ] **Step 3: Verify tabs work**

Navigate to Settings page -- tabs should switch smoothly between Git, Users, and Tokens sections.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/SettingsPage.tsx
git commit -m "feat: migrate SettingsPage tabs to shadcn Tabs"
```

---

## Task 24: Migrate CredentialsPage Tabs to shadcn

**Files:**
- Modify: `apps/frontend/src/pages/CredentialsPage.tsx`

- [ ] **Step 1: Replace custom tab bar with shadcn Tabs**

Same pattern as Task 23:
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

<Tabs defaultValue="variables" className="w-full">
  <TabsList>
    <TabsTrigger value="variables">
      <SlidersHorizontal size={13} className="mr-1.5" />
      Variables
    </TabsTrigger>
    <TabsTrigger value="credentials">
      <KeyRound size={13} className="mr-1.5" />
      Credentials
    </TabsTrigger>
  </TabsList>
  <TabsContent value="variables"><VariablesPanel /></TabsContent>
  <TabsContent value="credentials"><CredentialsPanel /></TabsContent>
</Tabs>
```

- [ ] **Step 2: Update background colors to theme tokens**

Replace hardcoded dark colors with `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/CredentialsPage.tsx
git commit -m "feat: migrate CredentialsPage tabs to shadcn Tabs"
```

---

## Task 25: Migrate Modals to shadcn Dialog

**Files:**
- Modify: `apps/frontend/src/pages/WorkflowsPage.tsx` (5 modals)
- Modify: `apps/frontend/src/pages/CredentialsPage.tsx` (2 modals)
- Modify: `apps/frontend/src/pages/SettingsPage.tsx` (1 modal)

- [ ] **Step 1: Replace modal pattern across all files**

Each existing modal uses this pattern:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
  <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl ...">
```

Replace with shadcn Dialog:
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Modal Title</DialogTitle>
      <DialogDescription>Description text</DialogDescription>
    </DialogHeader>
    {/* ... form content */}
    <DialogFooter>
      <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button onClick={handleSave}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Apply this to:
- **WorkflowsPage**: ExecutionHistoryModal, MoveWorkflowModal, NewFolderDialog, RenameFolderDialog, NewWorkflowDialog
- **CredentialsPage**: CredentialForm, VariableForm
- **SettingsPage**: ChangePasswordModal

- [ ] **Step 2: Replace inline form inputs with shadcn components**

Within each modal form, replace:
- `<input className={inputClass}>` with `<Input>`
- `<label>` with `<Label>`
- `<select>` with native select styled with theme tokens (or shadcn Select)
- Submit buttons with `<Button>`

- [ ] **Step 3: Verify all modals**

Open each modal across all pages. Test:
- Opens smoothly
- Escape key closes it
- Clicking overlay closes it
- Form submission works
- Cancel button works

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/WorkflowsPage.tsx apps/frontend/src/pages/CredentialsPage.tsx apps/frontend/src/pages/SettingsPage.tsx
git commit -m "feat: migrate all modals to shadcn Dialog"
```

---

## Task 26: Migrate Tables to shadcn Table

**Files:**
- Modify: `apps/frontend/src/pages/WorkflowsPage.tsx` (execution history table)
- Modify: `apps/frontend/src/pages/CredentialsPage.tsx` (variables table)
- Modify: `apps/frontend/src/pages/SettingsPage.tsx` (users table, tokens table)

- [ ] **Step 1: Replace raw tables with shadcn Table**

Add imports:
```typescript
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
```

Replace:
```tsx
// Before:
<table className="w-full text-xs">
  <thead>
    <tr className="text-slate-500 border-b border-slate-800">
      <th className="text-left py-2 pr-4 font-medium">Name</th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-slate-800/50 hover:bg-slate-800/40">
      <td className="py-2.5 pr-4">content</td>
    </tr>
  </tbody>
</table>

// After:
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>content</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

Apply to all 4-5 table instances across the pages.

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/WorkflowsPage.tsx apps/frontend/src/pages/CredentialsPage.tsx apps/frontend/src/pages/SettingsPage.tsx
git commit -m "feat: migrate all tables to shadcn Table components"
```

---

## Task 27: Add Page Transition Animations

**Files:**
- Modify: `apps/frontend/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Wrap Outlet with AnimatePresence for page transitions**

Update AppShell.tsx:
```typescript
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
```

Replace the `<Outlet />` with:
```tsx
const location = useLocation();

<main className="flex-1 overflow-y-auto">
  <AnimatePresence mode="wait">
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="h-full"
    >
      <Outlet />
    </motion.div>
  </AnimatePresence>
</main>
```

- [ ] **Step 2: Verify smooth page transitions**

Navigate between Workflows, Credentials, and Settings -- pages should fade in/out smoothly.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/layout/AppShell.tsx
git commit -m "feat: add smooth page transitions with framer-motion"
```

---

## Task 28: Canvas Theme Integration

**Files:**
- Modify: `apps/frontend/src/store/canvasDesignStore.ts`
- Modify: `apps/frontend/src/index.css`

- [ ] **Step 1: Update canvas CSS to use theme-aware variables**

In `index.css`, update the canvas-related CSS variables to respond to the `.dark` class:

The `:root` block already has canvas variables. Update them for light mode:
```css
:root {
  /* ... existing theme variables ... */
  --canvas-bg: #f8fafc;
  --canvas-dot-color: #e2e8f0;
}

.dark {
  /* ... existing theme variables ... */
  --canvas-bg: #0f172a;
  --canvas-dot-color: #1e293b;
}
```

Update React Flow overrides to use CSS variables:
```css
.react-flow__handle {
  border: 2px solid hsl(var(--muted-foreground)) !important;
  background: hsl(var(--secondary)) !important;
}

.react-flow__minimap {
  background-color: hsl(var(--secondary)) !important;
  border: 1px solid hsl(var(--border)) !important;
}

.react-flow__controls {
  background-color: hsl(var(--secondary)) !important;
  border: 1px solid hsl(var(--border)) !important;
}

.react-flow__controls-button {
  background-color: hsl(var(--secondary)) !important;
  border-bottom: 1px solid hsl(var(--border)) !important;
  color: hsl(var(--muted-foreground)) !important;
  fill: hsl(var(--muted-foreground)) !important;
}

.react-flow__controls-button:hover {
  background-color: hsl(var(--accent)) !important;
}
```

Also update scrollbar styles:
```css
* {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) hsl(var(--secondary));
}

::-webkit-scrollbar-track {
  background: hsl(var(--secondary));
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
}
```

- [ ] **Step 2: Remove the `.theme-bpmn-light` CSS block**

The separate BPMN light theme CSS overrides (lines 167-210 in index.css) can be removed since the CSS variable system now handles light mode automatically.

- [ ] **Step 3: Sync canvasDesignStore with global theme**

This is optional but nice: when the global theme changes, the canvas theme should follow. The simplest approach is to leave the canvas design store as-is but have the CSS variables handle the styling. The `.theme-bpmn-light` class is no longer needed since the global `.dark` / light class drives everything.

- [ ] **Step 4: Verify both themes on the canvas**

```bash
cd apps/frontend && pnpm dev
```

Open the editor. Toggle theme via sidebar (or Cmd+K -> Toggle Theme). Canvas should switch between dark and light backgrounds, minimap, controls, and handles should be correctly themed.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/index.css apps/frontend/src/store/canvasDesignStore.ts
git commit -m "feat: make canvas theme-aware via CSS variables"
```

---

## Task 29: Update index.html Title and Branding

**Files:**
- Modify: `apps/frontend/index.html`

- [ ] **Step 1: Update title to "ZuzuFlow"**

In `apps/frontend/index.html`, change `<title>Vite + React + TS</title>` (or whatever it currently says) to `<title>ZuzuFlow</title>`.

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/index.html
git commit -m "chore: update page title to ZuzuFlow"
```

---

## Task 30: Light Theme Polish Pass

**Files:**
- Multiple files across the codebase

- [ ] **Step 1: Systematically replace hardcoded dark colors**

Search for remaining hardcoded dark color classes and replace:

```bash
cd apps/frontend && grep -rn "bg-slate-950\|bg-slate-900\|bg-slate-800\|border-slate-700\|border-slate-800\|text-slate-200\|text-slate-400\|text-slate-500\|text-slate-600" src/ --include="*.tsx" | head -50
```

Replace common patterns:
| Hardcoded | Theme-aware |
|---|---|
| `bg-slate-950` | `bg-background` |
| `bg-slate-900` | `bg-card` |
| `bg-slate-800` | `bg-secondary` or `bg-muted` |
| `border-slate-700` | `border-border` |
| `border-slate-800` | `border-border` |
| `text-slate-200` | `text-foreground` |
| `text-slate-100` | `text-foreground` |
| `text-slate-400` | `text-muted-foreground` |
| `text-slate-500` | `text-muted-foreground` |
| `text-slate-600` | `text-muted-foreground` |
| `hover:bg-slate-800` | `hover:bg-accent` |
| `hover:bg-slate-700` | `hover:bg-accent` |

**Important**: Do NOT replace colors inside node components (NodeWrapper, the 37 node files) or canvas-specific styles. Only replace in pages, toolbar, palette, panels, and forms.

- [ ] **Step 2: Test light mode across all pages**

Toggle to light mode and verify:
- Login page looks correct
- Workflows page is readable
- Editor toolbar, palette, and panels are themed
- Credentials and Settings pages look good
- Canvas switches between light and dark correctly
- No invisible text (white-on-white) or unreadable elements

- [ ] **Step 3: Fix any remaining issues**

If any elements look wrong in light mode, update their classes to use theme tokens.

- [ ] **Step 4: Commit**

```bash
git add -u apps/frontend/src/
git commit -m "feat: polish light theme across all pages and components"
```

---

## Task 31: Final Animation Polish

**Files:**
- Modify: `apps/frontend/src/components/ui/button.tsx`
- Modify: Various page/component files

- [ ] **Step 1: Add whileTap to Button component**

In `apps/frontend/src/components/ui/button.tsx`, wrap the button with framer-motion for press feedback. The simplest approach is to add the animation as a utility wrapper used in specific places rather than modifying the base component (since not all buttons need it).

Create a small utility wrapper or add `whileTap` to primary action buttons throughout the app where it matters most: Login submit, Toolbar Run/Save, dialog confirm buttons.

- [ ] **Step 2: Add staggered entry to workflow cards (WorkflowsPage)**

In the workflow list rendering, wrap cards with framer-motion stagger:
```tsx
import { motion } from "framer-motion";
import { staggerContainer, staggerItem, spring } from "@/lib/motion";

<motion.div
  variants={staggerContainer}
  initial="initial"
  animate="animate"
  className="space-y-2"
>
  {workflows.map((wf) => (
    <motion.div key={wf.id} variants={staggerItem} transition={spring.gentle}>
      {/* ... workflow card content */}
    </motion.div>
  ))}
</motion.div>
```

- [ ] **Step 3: Add loading skeletons to WorkflowsPage**

Add a loading skeleton that shows while workflows are being fetched:
```tsx
import { Skeleton } from "@/components/ui/skeleton";

{loading ? (
  <div className="space-y-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border">
        <Skeleton className="h-4 w-4 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    ))}
  </div>
) : /* ... existing render */}
```

- [ ] **Step 4: Commit**

```bash
git add -u apps/frontend/src/
git commit -m "feat: add animation polish - staggered cards, loading skeletons, button press effects"
```

---

## Task 32: Final Build Verification

- [ ] **Step 1: Run full build**

```bash
cd apps/frontend && pnpm build
```

Expected: Build succeeds with zero errors.

- [ ] **Step 2: Run dev server and smoke test**

```bash
cd apps/frontend && pnpm dev
```

Verify:
1. Login page renders correctly (dark + light)
2. Navigate all pages via sidebar
3. Cmd+K opens command palette
4. Toggle theme multiple times -- no flicker, all pages correct
5. Open workflow editor -- toolbar, palette, canvas, properties panel all themed
6. Create a workflow, add nodes, connect edges, run execution
7. Manage credentials and variables
8. Test all toast notifications
9. No console errors

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final build verification for UI overhaul"
```
