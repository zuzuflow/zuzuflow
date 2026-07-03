import * as yaml from "js-yaml";
import { useWorkflowStore } from "../store/workflowStore";
import { getSdkHost } from "../store/sdkHostStore";
import type { WorkflowTemplate } from "@workflow/shared";

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useWorkflowSerializer() {
  const toTemplate = useWorkflowStore((s) => s.toTemplate);
  const loadTemplate = useWorkflowStore((s) => s.loadTemplate);
  const workflowName = useWorkflowStore((s) => s.workflowName);

  const exportJson = (): void => {
    const template = toTemplate();
    const json = JSON.stringify(template, null, 2);
    const safeName = workflowName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${safeName}.json`;
    // Hand the file to an embedding host if one registered; else download.
    const host = getSdkHost();
    if (host.onExport) host.onExport(json, filename, "json");
    else downloadFile(json, filename, "application/json");
  };

  const exportYaml = (): void => {
    const template = toTemplate();
    const yamlStr = yaml.dump(template, { indent: 2, lineWidth: 120 });
    const safeName = workflowName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${safeName}.yaml`;
    const host = getSdkHost();
    if (host.onExport) host.onExport(yamlStr, filename, "yaml");
    else downloadFile(yamlStr, filename, "text/yaml");
  };

  const importFromFile = async (file: File): Promise<void> => {
    const text = await file.text();
    let template: WorkflowTemplate;

    if (file.name.endsWith(".json")) {
      template = JSON.parse(text) as WorkflowTemplate;
    } else if (file.name.endsWith(".yaml") || file.name.endsWith(".yml")) {
      template = yaml.load(text) as WorkflowTemplate;
    } else {
      // Try JSON first, then YAML
      try {
        template = JSON.parse(text) as WorkflowTemplate;
      } catch {
        template = yaml.load(text) as WorkflowTemplate;
      }
    }

    if (template.version !== "1.0") {
      throw new Error(`Unsupported template version: ${template.version}`);
    }

    loadTemplate(template);
  };

  return { exportJson, exportYaml, importFromFile };
}
