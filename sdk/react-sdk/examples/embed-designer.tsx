/**
 * Embed Workflow Designer
 *
 * Demonstrates embedding the ZuzuFlow workflow Designer screen — the
 * drag-and-drop canvas, palette, properties panel, and execution log all
 * in one component. No routing, no app shell.
 *
 * Use this when you want to:
 *   - Add workflow editing to an existing page in your product
 *   - Build a custom UI around the Designer (your own header / nav / chrome)
 *   - Let users create or edit a single workflow
 *
 * Install:
 *   npm install @zuzuflow/react-sdk react react-dom @xyflow/react react-router-dom zustand @monaco-editor/react
 */

import React, { useState } from "react";
import { WorkflowDesigner } from "@zuzuflow/react-sdk";
import "@xyflow/react/dist/style.css";

// ── Example 1: New workflow — empty canvas ──────────────────────────────────

export function NewWorkflow() {
  return (
    <div style={{ height: "600px", border: "1px solid #374151", borderRadius: 8, overflow: "hidden" }}>
      <WorkflowDesigner
        apiUrl="https://app.zuzuflow.com/api"
        token="your-jwt-token"
        envSlug="production"
        onSave={(id) => console.log("Workflow saved:", id)}
      />
    </div>
  );
}

// ── Example 2: Edit existing workflow ───────────────────────────────────────

export function EditWorkflow({ workflowId }: { workflowId: string }) {
  return (
    <div style={{ height: "80vh" }}>
      <WorkflowDesigner
        apiUrl="https://app.zuzuflow.com/api"
        token="your-jwt-token"
        envSlug="production"
        workflowId={workflowId}
        onSave={(id) => console.log("Updated:", id)}
      />
    </div>
  );
}

// ── Example 3: Designer wrapped in your own chrome ──────────────────────────

export function CustomDesignerPage() {
  const [workflowId, setWorkflowId] = useState<string>("new");

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
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
          <option value="new">New workflow</option>
          <option value="wf_abc">Order Processing</option>
          <option value="wf_def">User Onboarding</option>
        </select>
      </header>

      <div style={{ flex: 1 }}>
        <WorkflowDesigner
          apiUrl="https://app.zuzuflow.com/api"
          token="your-jwt-token"
          envSlug="production"
          workflowId={workflowId}
          onSave={(id) => setWorkflowId(id)}
        />
      </div>
    </div>
  );
}
