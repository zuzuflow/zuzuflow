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
  const logout = useApiConfigStore((s) => s.clearAuth);

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
