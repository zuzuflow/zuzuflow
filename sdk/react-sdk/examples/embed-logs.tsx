/**
 * Embed Workflow Logs
 *
 * Demonstrates embedding the ZuzuFlow Logs screen — Grafana-style log
 * search across every execution + an Executions tab for browsing run
 * history. No routing, no app shell.
 *
 * Use this when you want to:
 *   - Surface workflow run history in your product's existing observability page
 *   - Let your support / ops team drill into a failing execution without
 *     leaving your app
 *
 * Install:
 *   npm install @zuzuflow/react-sdk react react-dom @xyflow/react react-router-dom zustand @monaco-editor/react
 */

import React from "react";
import { WorkflowLogs } from "@zuzuflow/react-sdk";

// ── Example 1: Logs viewer on its own ───────────────────────────────────────

export function LogsViewer() {
  return (
    <div style={{ height: "100vh" }}>
      <WorkflowLogs
        apiUrl="https://app.zuzuflow.com/api"
        token="your-jwt-token"
        envSlug="production"
      />
    </div>
  );
}

// ── Example 2: Logs in a card with a custom header ──────────────────────────

export function LogsCard() {
  return (
    <section
      style={{
        height: "70vh",
        border: "1px solid #374151",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "10px 16px",
          background: "#0f172a",
          color: "white",
          fontSize: 14,
          fontWeight: 600,
          borderBottom: "1px solid #1e293b",
        }}
      >
        Workflow execution history
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <WorkflowLogs
          apiUrl="https://app.zuzuflow.com/api"
          token="your-jwt-token"
          envSlug="production"
        />
      </div>
    </section>
  );
}
