import React, { useRef, useEffect, useState, useCallback } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { X, FileCode2, FileType, Loader2, Package } from "lucide-react";
import {
  WORKFLOW_RUNTIME_TYPES,
  TypeDefinition,
} from "@/lib/typeAcquisition";

type IDisposable = { dispose(): void };
type LanguageDefaults = {
  setCompilerOptions(opts: any): void;
  setDiagnosticsOptions(opts: any): void;
  addExtraLib(content: string, filePath?: string): IDisposable;
};

interface CodeEditorModalProps {
  open: boolean;
  onClose: () => void;
  language: "javascript" | "typescript" | "python";
  value: string;
  onChange: (value: string) => void;
  title?: string;
  /** Pre-resolved type definitions from usePackageTypes hook */
  typeDefs?: TypeDefinition[];
  /** Whether types are currently loading */
  typesLoading?: boolean;
}

const LANG_META: Record<string, { label: string; ext: string; iconColor: string }> = {
  typescript: { label: "TypeScript", ext: ".ts", iconColor: "text-blue-400" },
  javascript: { label: "JavaScript", ext: ".js", iconColor: "text-yellow-400" },
  python: { label: "Python", ext: ".py", iconColor: "text-green-400" },
};

export function CodeEditorModal({
  open,
  onClose,
  language,
  value,
  onChange,
  title,
  typeDefs,
  typesLoading,
}: CodeEditorModalProps): React.ReactElement | null {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const defaultsRef = useRef<LanguageDefaults | null>(null);
  const disposablesRef = useRef<IDisposable[]>([]);

  // Register type definitions with Monaco — called on mount AND when typeDefs change
  const registerTypes = useCallback((defaults: LanguageDefaults, defs: TypeDefinition[]) => {
    // Dispose previous package type registrations (keep runtime types)
    disposablesRef.current.forEach((d) => d.dispose());
    disposablesRef.current = [];

    // Register workflow runtime types
    const d1 = defaults.addExtraLib(
      WORKFLOW_RUNTIME_TYPES.content,
      WORKFLOW_RUNTIME_TYPES.filePath
    );
    disposablesRef.current.push(d1);

    // Register package types
    for (const def of defs) {
      const d = defaults.addExtraLib(def.content, def.filePath);
      disposablesRef.current.push(d);
    }
  }, []);

  // Re-register types when typeDefs change (live updates while editor is open)
  useEffect(() => {
    if (!open || !defaultsRef.current) return;
    registerTypes(defaultsRef.current, typeDefs ?? []);
  }, [open, typeDefs, registerTypes]);

  // Cleanup when modal closes or unmounts
  useEffect(() => {
    if (!open) {
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
      defaultsRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
    };
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    if (language === "typescript" || language === "javascript") {
      const defaults = language === "typescript"
        ? monaco.languages.typescript.typescriptDefaults
        : monaco.languages.typescript.javascriptDefaults;

      defaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        strict: false,
        allowJs: true,
        checkJs: language === "javascript",
        esModuleInterop: true,
        resolveJsonModule: true,
      });

      defaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      // Store defaults ref for live type updates
      defaultsRef.current = defaults;
      registerTypes(defaults, typeDefs ?? []);
    }

    editor.focus();
    editor.addCommand(monaco.KeyCode.Escape, () => onClose());
  };

  if (!open) return null;

  const meta = LANG_META[language] ?? LANG_META.javascript;
  const Icon = language === "typescript" ? FileType : FileCode2;
  const defCount = typeDefs?.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1e1e1e]">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 h-10 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
        <Icon size={14} className={meta.iconColor} />
        <span className="text-xs font-medium text-[#cccccc]">
          {title ?? "expression"}{meta.ext}
        </span>
        <span className="text-[10px] text-[#858585] ml-1">— {meta.label}</span>

        <div className="flex items-center gap-1 ml-auto">
          <kbd className="text-[10px] bg-[#3c3c3c] text-[#858585] px-1.5 py-0.5 rounded font-mono">
            Esc to close
          </kbd>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#858585] hover:text-[#cccccc] hover:bg-[#3c3c3c] transition-colors"
            title="Close editor"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Monaco editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={language}
          value={value}
          theme="vs-dark"
          onMount={handleMount}
          onChange={(v) => onChange(v ?? "")}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
            fontLigatures: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            tabSize: 2,
            wordWrap: "on",
            lineNumbers: "on",
            renderLineHighlight: "gutter",
            bracketPairColorization: { enabled: true },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            padding: { top: 12, bottom: 12 },
            acceptSuggestionOnCommitCharacter: false,
            acceptSuggestionOnEnter: "off",
            suggest: {
              showKeywords: true,
              showSnippets: true,
              showClasses: true,
              showFunctions: true,
              showVariables: true,
              showModules: true,
              showProperties: true,
              showInterfaces: true,
              showMethods: true,
              insertMode: "replace",
            },
            parameterHints: { enabled: true },
          }}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 h-6 bg-[#007acc] shrink-0">
        <span className="text-[10px] text-white font-medium">{meta.label}</span>

        {(language === "typescript" || language === "javascript") && (
          <span className="flex items-center gap-1.5 text-[10px] text-white/80">
            {typesLoading ? (
              <>
                <Loader2 size={10} className="animate-spin" />
                Loading types...
              </>
            ) : defCount > 0 ? (
              <>
                <Package size={10} />
                {defCount} type{defCount !== 1 ? "s" : ""} registered
              </>
            ) : null}
          </span>
        )}

        <span className="text-[10px] text-white/70 ml-auto">
          {language === "python" ? (
            <>
              <code className="font-mono">input</code> dict = node outputs · set <code className="font-mono">result</code> variable to return data
            </>
          ) : (
            <>
              Define <code className="font-mono">const main = (input, context) =&gt; &#123; ... &#125;</code> · <code className="font-mono">input</code> = node outputs · <code className="font-mono">context</code> = &#123; workflowId, executionId, triggerPayload &#125;
            </>
          )}
        </span>
      </div>
    </div>
  );
}
