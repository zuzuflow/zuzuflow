/**
 * Embed Editor Only Example
 *
 * Demonstrates embedding just the ZuzuFlow workflow canvas editor
 * without the full app chrome (no sidebar, no routing).
 *
 * Use this when you want to:
 *   - Add workflow editing to an existing page
 *   - Build a custom UI around the editor
 *   - Let users create/edit a single workflow
 *
 * Install:
 *   npm install @zuzuflow/react-sdk
 */

import React, { useState } from "react";
import { WorkflowEditor } from "@zuzuflow/react-sdk";
import "@zuzuflow/react-sdk/style.css";

// ── Example 1: New Workflow Editor ───────────────────────────────────────────
// Render an empty canvas where users can build a new workflow.

export function NewWorkflowEditor() {
  const handleSave = (workflowId: string) => {
    console.log("Workflow saved with ID:", workflowId);
    // Navigate to workflow list, show success toast, etc.
  };

  return (
    <div style={{ height: "600px", border: "1px solid #374151", borderRadius: 8, overflow: "hidden" }}>
      <WorkflowEditor
        apiUrl="https://app.zuzuflow.com/api"
        token="your-jwt-token"
        onSave={handleSave}
      />
    </div>
  );
}

// ── Example 2: Edit Existing Workflow ────────────────────────────────────────
// Load and edit a specific workflow by ID.

export function EditWorkflow({ workflowId }: { workflowId: string }) {
  return (
    <div style={{ height: "80vh" }}>
      <WorkflowEditor
        apiUrl="https://app.zuzuflow.com/api"
        token="your-jwt-token"
        workflowId={workflowId}
        onSave={(id) => console.log("Updated workflow:", id)}
      />
    </div>
  );
}

// ── Example 3: Workflow Editor with Custom Header ────────────────────────────
// Wrap the editor in your own UI.

export function CustomEditorPage() {
  const [workflowId, setWorkflowId] = useState<string>("new");

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Your custom header */}
      <header
        style={{
          padding: "12px 24px",
          background: "#0f172a",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ color: "white", margin: 0, fontSize: 16 }}>
          Workflow Builder
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            style={{
              background: "#1e293b",
              color: "white",
              border: "1px solid #374151",
              borderRadius: 6,
              padding: "6px 12px",
            }}
          >
            <option value="new">New Workflow</option>
            <option value="workflow-id-1">Order Processing</option>
            <option value="workflow-id-2">User Onboarding</option>
          </select>
        </div>
      </header>

      {/* Editor fills remaining space */}
      <div style={{ flex: 1 }}>
        <WorkflowEditor
          apiUrl="https://app.zuzuflow.com/api"
          token="your-jwt-token"
          workflowId={workflowId}
          onSave={(id) => {
            console.log("Saved:", id);
            setWorkflowId(id);
          }}
        />
      </div>
    </div>
  );
}
