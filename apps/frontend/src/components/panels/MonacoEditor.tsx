import React, { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
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

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  language?: string;
  /** Pre-resolved type definitions from usePackageTypes hook */
  typeDefs?: TypeDefinition[];
}

function LoadingSkeleton({ height }: { height: number }): React.ReactElement {
  return (
    <div
      className="bg-card border border-border rounded-md animate-pulse"
      style={{ height }}
    >
      <div className="p-3 space-y-2">
        {Array.from({ length: Math.floor(height / 24) }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-muted rounded"
            style={{ width: `${40 + (i % 5) * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function MonacoEditor({
  value,
  onChange,
  height = 300,
  language = "typescript",
  typeDefs,
}: MonacoEditorProps): React.ReactElement {
  const defaultsRef = useRef<LanguageDefaults | null>(null);
  const disposablesRef = useRef<IDisposable[]>([]);

  const registerTypes = (defaults: LanguageDefaults, defs: TypeDefinition[]) => {
    disposablesRef.current.forEach((d) => d.dispose());
    disposablesRef.current = [];

    const d1 = defaults.addExtraLib(
      WORKFLOW_RUNTIME_TYPES.content,
      WORKFLOW_RUNTIME_TYPES.filePath
    );
    disposablesRef.current.push(d1);

    for (const def of defs) {
      const d = defaults.addExtraLib(def.content, def.filePath);
      disposablesRef.current.push(d);
    }
  };

  // Re-register when typeDefs change
  useEffect(() => {
    if (defaultsRef.current) {
      registerTypes(defaultsRef.current, typeDefs ?? []);
    }
  }, [typeDefs]);

  useEffect(() => {
    return () => {
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
    };
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    const isTs = language === "typescript";
    const defaults = isTs
      ? monaco.languages.typescript.typescriptDefaults
      : monaco.languages.typescript.javascriptDefaults;

    defaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      strictFunctionTypes: true,
      allowJs: true,
      esModuleInterop: true,
    });

    defaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    defaultsRef.current = defaults;
    registerTypes(defaults, typeDefs ?? []);

    editor.focus();
  };

  return (
    <div className="rounded-md overflow-hidden border border-border" style={{ height }}>
      <Editor
        height={height}
        language={language}
        theme="vs-dark"
        value={value}
        loading={<LoadingSkeleton height={height} />}
        onMount={handleMount}
        onChange={(val) => onChange(val ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          tabSize: 2,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          lineNumbers: "on",
          renderLineHighlight: "gutter",
          padding: { top: 8, bottom: 8 },
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          acceptSuggestionOnCommitCharacter: false,
          acceptSuggestionOnEnter: "off",
          parameterHints: { enabled: true },
        }}
      />
    </div>
  );
}
