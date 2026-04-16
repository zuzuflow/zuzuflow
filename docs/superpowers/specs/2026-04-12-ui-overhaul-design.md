# ZuzuFlow UI Overhaul Design Spec

## Context

ZuzuFlow is a visual workflow automation platform (like n8n/Make.com) with a React 18 + TypeScript + Vite + Tailwind CSS frontend. The current UI is functional but utilitarian -- all styling is raw Tailwind utility classes with no component library, repeated inline patterns (the same `inputClass` defined in 5+ files, 7+ hand-built modals, 11 `alert()` calls, 6 `confirm()` calls), and a dark-only theme hardcoded throughout.

**Goal**: Transform the UI into a modern, polished experience inspired by Raycast -- spring animations, fluid hover states, satisfying micro-interactions. Both dark and light themes polished. Add shadcn/ui as the component foundation.

---

## 1. Foundation & Dependencies

### New packages (installed in `apps/frontend/`)

```
# Radix UI primitives (shadcn foundation)
@radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-popover
@radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-select
@radix-ui/react-separator @radix-ui/react-switch @radix-ui/react-alert-dialog
@radix-ui/react-slot @radix-ui/react-label @radix-ui/react-toast

# Styling & animation
class-variance-authority tailwindcss-animate framer-motion

# New features
cmdk sonner
```

### Path alias setup

**`apps/frontend/tsconfig.json`**: Add `"@/*": ["./src/*"]` to `paths`

**`apps/frontend/vite.config.ts`**: Add `"@": path.resolve(__dirname, "./src")` to `resolve.alias`

### `components.json` (shadcn CLI config)

Create at `apps/frontend/components.json`:
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

Then scaffold components via `npx shadcn@latest add button input label select dialog tabs table badge separator tooltip popover dropdown-menu toast command sheet switch alert-dialog sonner skeleton card`.

---

## 2. Theme System

### CSS variable theming in `index.css`

Add HSL-based CSS variables under `@layer base`. Light theme is `:root`, dark is `.dark`:

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `0 0% 100%` (white) | `222.2 84% 4.9%` (slate-950) |
| `--foreground` | `222.2 84% 4.9%` | `210 40% 98%` |
| `--card` | `0 0% 100%` | `217.2 32.6% 11%` (slate-900) |
| `--card-foreground` | `222.2 84% 4.9%` | `210 40% 98%` |
| `--popover` | `0 0% 100%` | `217.2 32.6% 11%` |
| `--primary` | `238.7 83.5% 66.7%` (indigo-500) | `238.7 83.5% 66.7%` |
| `--primary-foreground` | `210 40% 98%` | `210 40% 98%` |
| `--secondary` | `210 40% 96.1%` | `217.2 32.6% 17.5%` (slate-800) |
| `--muted` | `210 40% 96.1%` | `217.2 32.6% 17.5%` |
| `--muted-foreground` | `215.4 16.3% 46.9%` | `215 20.2% 65.1%` |
| `--accent` | `210 40% 96.1%` | `217.2 32.6% 17.5%` |
| `--destructive` | `0 84.2% 60.2%` | `0 62.8% 30.6%` |
| `--border` | `214.3 31.8% 91.4%` | `217.2 32.6% 22%` (slate-700) |
| `--input` | `214.3 31.8% 91.4%` | `217.2 32.6% 22%` |
| `--ring` | `238.7 83.5% 66.7%` | `238.7 83.5% 66.7%` |
| `--radius` | `0.5rem` | `0.5rem` |

Existing node category CSS variables (`--node-trigger-bg`, etc.) and canvas variables (`--canvas-bg`, `--canvas-dot-color`) stay in `:root` with dark overrides in `.dark`.

### ThemeProvider

New file: `src/components/theme-provider.tsx`

- React context wrapping `<App />`
- Reads from localStorage key `trioflow-theme`
- Supports `"dark" | "light" | "system"`
- Default: `"dark"`
- Toggles class on `<html>` element
- Listens to `prefers-color-scheme` changes when set to `"system"`

### Tailwind config update

**`apps/frontend/tailwind.config.ts`**:
- Add CSS variable-based colors: `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `popover`, `border`, `input`, `ring`
- Add `borderRadius` with `var(--radius)` base
- Add `tailwindcss-animate` plugin
- Keep existing `brand.*`, `node.*` color tokens
- Add accordion keyframes for Radix

---

## 3. Shared App Shell

### Current problem

Each page renders its own top bar: WorkflowsPage has inline folder + workflow management, CredentialsPage has back arrow + icon + title, SettingsPage has the same. No consistent navigation between pages.

### New layout: `AppShell.tsx`

A persistent sidebar layout wrapping all protected pages **except** the WorkflowEditorPage (which stays full-bleed canvas).

**Sidebar spec**:
- Width: 56px collapsed (icon rail), 240px expanded
- Toggle: hover-expand or pin button
- Position: fixed left, full height
- Background: `bg-card/80 backdrop-blur-xl border-r border-border`
- Top: ZuzuFlow logo (collapsed = icon, expanded = icon + "ZuzuFlow" wordmark)
- Nav items (top-aligned):
  - Workflows (`LayoutGrid` icon) -> `/`
  - Credentials (`KeyRound` icon) -> `/credentials`
  - Settings (`Settings` icon) -> `/settings`
- Active state: `bg-primary/10 text-primary` with 2px left accent border, animated via `layoutId`
- Bottom section: Theme toggle (sun/moon), Cmd+K hint, user avatar + logout dropdown

**Route restructuring in `App.tsx`**:
```tsx
<Route element={<AppShell />}>
  <Route path="/" element={<AuthGuard><WorkflowsPage /></AuthGuard>} />
  <Route path="/credentials" element={<AuthGuard><CredentialsPage /></AuthGuard>} />
  <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
</Route>
<Route path="/editor/:id" element={<AuthGuard><WorkflowEditorPage /></AuthGuard>} />
<Route path="/login" element={<LoginPage />} />
```

### PageHeader component

Consistent header for all shell pages:
- Props: `title`, `description`, `icon`, `actions` (ReactNode slot)
- Layout: icon in rounded bg + title + description on left, action buttons on right
- Mount animation: `initial={{ opacity: 0, y: -8 }}` -> `animate={{ opacity: 1, y: 0 }}`

---

## 4. Component Migration Map

| shadcn/ui Component | Replaces | Files Affected |
|---|---|---|
| `Button` (default, ghost, outline, destructive, secondary) | 6+ inline button class patterns | Every page, Toolbar, NodePalette, PropertiesPanel, all forms |
| `Input` | `inputClass` constant (defined 5+ times independently) | LoginPage, CredentialsPage, SettingsPage, 33 node form files |
| `Label` | `<label className="block text-xs font-medium text-slate-400 mb-1">` | All form locations |
| `Select` | Native `<select>` elements | CredentialSelector, CredentialForm, node forms |
| `Dialog` | 7+ hand-built modal patterns with `fixed inset-0 z-50` | WorkflowsPage (5), CredentialsPage (2), SettingsPage (1) |
| `AlertDialog` | 6 `confirm()` calls | WorkflowsPage, CredentialsPage, SettingsPage |
| `Tabs` | Custom tab bars | SettingsPage, CredentialsPage |
| `Table` | 5 raw `<table>` elements | ExecutionHistory, Users, Tokens, Variables, Credentials |
| `Badge` | Status badge patterns `px-2 py-0.5 text-[10px] font-bold` | Toolbar, WorkflowsPage, ExecutionLog, SettingsPage |
| `Separator` | `<div className="h-5 w-px bg-slate-700" />` | Toolbar, menus |
| `Tooltip` | `title` attributes | Toolbar (6 buttons), palette items |
| `DropdownMenu` | Custom export menu + folder context menu | Toolbar, WorkflowsPage |
| `Popover` | Floating DesignPanel | DesignPanel |
| `Sheet` | PropertiesPanel slide-in | PropertiesPanel |
| `Toast` (Sonner) | 11 `alert()` calls + inline success/error messages | All pages, Toolbar |
| `Command` (cmdk) | New feature: Cmd+K palette | New global component |
| `Switch` | Custom checkboxes | WorkflowsPage, CredentialsPage |
| `Skeleton` | New feature: loading states | All list/table views |
| `Card` | `bg-slate-900 border border-slate-800 rounded-xl` cards | All pages |

**Note**: TemplateInput/TemplateTextarea wrappers keep their autocomplete behavior but use shadcn `Input` internally. Node visual components (NodeWrapper, the 37 node types) are NOT touched -- they're a separate domain from the app chrome.

---

## 5. Page Redesigns

### 5.1 LoginPage

**Current**: Basic centered card, slate-950 bg, GitBranch icon + "Workflow Automation" text.

**New**:
- Two-column desktop layout (left: branding panel, right: form). Single column on mobile.
- **Left panel** (>=md): gradient background `from-primary/20 via-background to-background`, large ZuzuFlow logo, tagline "Visual workflow automation", decorative floating node shapes with slow drift animation
- **Right panel**: centered form card with `bg-card border-border rounded-2xl shadow-2xl backdrop-blur-sm`
- "Welcome back" heading, "Sign in to your account" subtext
- shadcn Input + Label, Button with loading spinner
- Error: `motion.div` with spring entry + red accent
- Submit: `whileTap={{ scale: 0.98 }}`, success redirect with exit fade

### 5.2 WorkflowsPage

**Current**: ~730 line monolithic component. Custom top bar, inline modals, basic list.

**Decompose into**:
```
pages/workflows/
  WorkflowsPage.tsx
  components/
    WorkflowCard.tsx
    FolderTree.tsx
    FolderTreeItem.tsx
    ExecutionHistoryModal.tsx
    MoveWorkflowModal.tsx
    NewWorkflowDialog.tsx
    WorkflowEmptyState.tsx
    WorkflowListSkeleton.tsx
```

**Changes**:
- Remove custom top bar (now in AppShell)
- Page header via shared `PageHeader`: icon=LayoutGrid, title="Workflows", actions=[New Workflow, Refresh]
- Workflow cards: `bg-card border-border rounded-xl p-4`, hover elevation via `whileHover={{ y: -2 }}` spring
- Status badges: shadcn Badge (active=green, draft=amber, inactive=secondary)
- Context menus: shadcn DropdownMenu (replacing custom fixed-position divs)
- Loading: skeleton cards with staggered shimmer
- Empty state: illustrated SVG + "No workflows yet" + CTA button
- Modals: all upgraded to shadcn Dialog with spring animation
- Delete confirmations: shadcn AlertDialog (replacing `confirm()`)

### 5.3 WorkflowEditorPage

**Stays full-screen** (no AppShell). Changes:

**Toolbar**:
- Glass effect: `bg-card/80 backdrop-blur-xl border-b border-border`
- Left: back button (ghost) + ZuzuFlow mini logo + separator + workflow name input
- Right: grouped button clusters with shadcn Separator between groups
- All buttons get shadcn Button component + Tooltip wrappers
- Save: animated state transitions (idle -> spinner -> checkmark flash -> idle)
- Run: larger primary button with pulse while running
- Export: shadcn DropdownMenu
- Design: shadcn Popover

**NodePalette**:
- Smoother collapse/expand with framer-motion AnimatePresence
- Search: shadcn Input with clear button fade
- Items: hover lift `whileHover={{ x: 2 }}` with spring
- Empty search: "No matching nodes" with icon

**PropertiesPanel**:
- Slide-in from right: `initial={{ x: 50, opacity: 0 }}` spring animation
- Standardized 360px width
- shadcn Input, Select, Switch, Label in all form sections

**ExecutionLog**:
- Slide-up drawer with spring animation
- Status pills: shadcn Badge

**Canvas**:
- Theme-aware via CSS variables (bg, dot color, minimap, controls)
- Glass effect on controls/minimap

### 5.4 CredentialsPage

**Current**: ~643 lines. Two tabs, modal forms, grouped credentials.

**Decompose into**:
```
pages/credentials/
  CredentialsPage.tsx
  components/
    VariablesPanel.tsx
    CredentialsPanel.tsx
    VariableForm.tsx
    CredentialForm.tsx
    CredentialGroup.tsx
    EmptyCredentials.tsx
    EmptyVariables.tsx
```

**Changes**:
- Remove custom top bar (AppShell)
- Tabs: shadcn Tabs with underline variant
- Tables: shadcn Table components
- Forms: shadcn Dialog + Input + Select + Label + Switch
- Expand/collapse: framer-motion animation on credential groups
- Copy: shows toast via Sonner instead of inline state
- Empty states: illustrated with relevant icons
- Tab transition: AnimatePresence cross-fade

### 5.5 SettingsPage

**Current**: ~739 lines. Three tabs: Git, Users, Tokens.

**Decompose into**:
```
pages/settings/
  SettingsPage.tsx
  components/
    GitTab.tsx
    UsersTab.tsx
    ApiTokensTab.tsx
    ChangePasswordModal.tsx
```

**Changes**:
- Remove custom top bar (AppShell)
- Tabs: shadcn Tabs with pill variant
- Tables: shadcn Table
- Forms: shadcn Input + Label + Select
- Provider selector: visual card radio group
- Modals: shadcn Dialog (change password)
- Delete/Revoke: shadcn AlertDialog (replacing `confirm()`)
- Results: toast notifications (replacing inline ResultPill where appropriate)

---

## 6. Animation Strategy

### Motion presets (`src/lib/motion.ts`)

```ts
export const spring = {
  gentle: { type: "spring", stiffness: 300, damping: 30 },
  snappy: { type: "spring", stiffness: 500, damping: 30 },
  bouncy: { type: "spring", stiffness: 400, damping: 20, mass: 0.8 },
};

export const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
export const scaleIn = { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 } };
export const slideUp = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 8 } };
export const slideRight = { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } };
```

### Animation map

| Interaction | Technique |
|---|---|
| Button press | `whileTap={{ scale: 0.97 }}` |
| Card hover | `whileHover={{ y: -2 }}` + spring |
| Dialog open/close | `scaleIn` + `spring.snappy` |
| Dropdown/Popover | `slideUp` + `spring.gentle` |
| Sheet (PropertiesPanel) | `slideRight` + `spring.snappy` |
| Page transitions | `AnimatePresence` + `fadeIn` on route change |
| Workflow card list | `staggerChildren` with `slideUp` per card |
| Node palette expand | `AnimatePresence` + height animation |
| Sidebar active pill | `layoutId` shared layout animation |
| Execution log drawer | Animate height with `spring.snappy` |
| Toast | Sonner built-in spring (position: bottom-right) |
| Status changes | `AnimatePresence` cross-fade |
| Loading skeletons | Staggered entry + `animate-pulse` shimmer |
| Save button states | Cross-fade between idle/saving/saved icons |

### CSS-only (keep lightweight)

- Hover background transitions: existing `transition-colors` preserved
- Focus ring: `transition: box-shadow 0.15s`
- Scrollbar styling: thin custom scrollbar
- Canvas edge animations: existing CSS keyframes preserved

---

## 7. Command Palette

New file: `src/components/layout/CommandPalette.tsx`

- Trigger: `Cmd+K` (Mac) / `Ctrl+K` (Windows), global keyboard listener
- Rendered inside Radix Dialog for focus management
- Uses `cmdk` library for search/filter
- Background: `bg-popover/95 backdrop-blur-xl border-border rounded-xl shadow-2xl`, max-width 560px
- Groups:
  - **Navigation**: Go to Workflows, Credentials, Settings
  - **Actions**: New Workflow, New Subworkflow, Toggle Theme, Logout
  - **Recent Workflows**: last 5 (from localStorage)
- Each item: icon + label + optional keyboard shortcut hint
- Open animation: `scaleIn` spring, staggered result items

Mounted inside `AppShell` + wired into editor toolbar via search button.

---

## 8. Branding

Replace "Workflow Automation" + GitBranch icon with proper "ZuzuFlow" branding:

- **Logo component** (`src/components/branding/Logo.tsx`): stylized icon in rounded square with gradient + "ZuzuFlow" wordmark in Inter semibold
- Props: `size: 'sm' | 'md' | 'lg'`, `showText: boolean`
- Used in: LoginPage (large), AppShell sidebar (small/medium), Editor toolbar (small icon-only)
- Update `index.html` title to "ZuzuFlow"

---

## 9. Migration Order

Each phase leaves the app in a working state:

| Phase | Scope | Visual Impact |
|---|---|---|
| **0. Foundation** | Deps, path aliases, CSS variables, ThemeProvider, `ui/` component files, `motion.ts` | Zero visual change |
| **1. Primitives** | Button, Input, Label, Badge, Separator, Switch across all files | Consistent components everywhere |
| **2. Toasts** | Sonner setup, AlertDialog, replace all alert()/confirm() | Proper notifications |
| **3. Dialog, Tabs, Table** | Upgrade 8 modals, 2 tab bars, 5 tables | Polished data views |
| **4. AppShell + Sidebar** | New layout, remove per-page top bars, add PageHeader | Unified navigation |
| **5. DropdownMenu, Popover, Select, Tooltip** | Interactive components | Polished interactions |
| **6. Sheet + Command Palette** | PropertiesPanel + Cmd+K | Slide-in panel, global search |
| **7. Page decomposition** | Break up WorkflowsPage, CredentialsPage, SettingsPage | Cleaner code |
| **8. LoginPage redesign** | Two-column layout, branding | First impression |
| **9. Animations** | framer-motion polish pass on all interactions | Raycast-level feel |
| **10. Light theme** | Test + tune every component in light mode | Dual theme complete |
| **11. Branding** | Logo component, favicon, title updates | Professional identity |

---

## 10. Key Architectural Decisions

1. **shadcn/ui components are code-generated, not installed as a package.** Each component lives in `src/components/ui/` and can be customized. Use `npx shadcn@latest add` or manually create following shadcn patterns.

2. **TemplateInput/TemplateTextarea keep their autocomplete behavior.** They wrap shadcn Input internally but retain their custom hook logic.

3. **Node visual components (NodeWrapper, 37 node types) are NOT touched.** They use inline styles for category-based coloring and are a separate domain from the app chrome.

4. **Zustand stores remain unchanged.** The UI overhaul is purely presentational.

5. **Use Sonner over shadcn's built-in Toast.** Better defaults, stacking, and animation.

6. **Button `size="sm"` is the default in this app.** Current design uses `text-xs px-3 py-1.5` everywhere, mapping to shadcn's `sm` variant.

7. **The 33 node form files** each independently define `inputClass`/`labelClass`. Migration is mechanical -- replace with `<Input>` and `<Label>`. Can be batched by category (triggers, logic, actions, etc.).

---

## 11. Verification Plan

After each migration phase:

1. **Build check**: `pnpm build` in `apps/frontend/` succeeds with no TypeScript errors
2. **Dev server**: `pnpm dev` launches, all routes load
3. **Visual regression**: manually verify each page looks correct in both dark and light themes
4. **Interaction test**: click every button, open every modal, submit every form
5. **Canvas test**: create a workflow, drag nodes, connect edges, run execution
6. **Console check**: no React warnings, no Radix hydration errors

Final verification (after all phases):
- Test login flow (dark + light)
- Navigate all pages via sidebar
- Open Cmd+K and navigate to a workflow
- Create, edit, run, delete a workflow
- Manage credentials and variables
- Test settings tabs (Git, Users, Tokens)
- Toggle theme multiple times
- Test all toast notifications (success, error, destructive confirmations)
- Verify all animations are smooth (no jank, no layout shifts)
