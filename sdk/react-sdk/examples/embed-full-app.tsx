/**
 * Embed Full ZuzuFlow App Example
 *
 * Demonstrates embedding the complete ZuzuFlow workflow platform
 * inside your React application. Includes workflow list, editor,
 * credentials, and settings — all in one component.
 *
 * Install:
 *   npm install @zuzuflow/react-sdk
 *
 * Setup:
 *   1. Get a JWT token by calling POST /api/auth/login
 *   2. Or use a master API token from Settings → API Tokens
 */

import React, { useState, useEffect } from "react";
import { WorkflowApp } from "@zuzuflow/react-sdk";
import "@zuzuflow/react-sdk/style.css";

// ── Example 1: Basic Embed ───────────────────────────────────────────────────
// Embed ZuzuFlow with a static token. Simplest setup.

export function BasicEmbed() {
  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <WorkflowApp
        apiUrl="https://app.zuzuflow.com/api"
        token="your-jwt-or-api-token"
      />
    </div>
  );
}

// ── Example 2: With Authentication ───────────────────────────────────────────
// Login to ZuzuFlow API first, then embed with the JWT.

export function AuthenticatedEmbed() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Login to get a JWT token
    fetch("https://app.zuzuflow.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernameOrEmail: "your-username",
        password: "your-password",
      }),
    })
      .then((res) => res.json())
      .then((data) => setToken(data.token))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div>Login failed: {error}</div>;
  if (!token) return <div>Authenticating...</div>;

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <WorkflowApp
        apiUrl="https://app.zuzuflow.com/api"
        token={token}
        initialPath="/" // Start at workflow list (default)
      />
    </div>
  );
}

// ── Example 3: Open Directly to Editor ───────────────────────────────────────
// Navigate directly to a specific workflow's editor.

export function DirectToEditor() {
  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <WorkflowApp
        apiUrl="https://app.zuzuflow.com/api"
        token="your-jwt-token"
        initialPath="/editor/your-workflow-id"
      />
    </div>
  );
}

// ── Example 4: Embedded in a Dashboard Tab ───────────────────────────────────
// Show ZuzuFlow as one tab in a larger application.

export function DashboardWithWorkflows() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "workflows">("dashboard");

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Your app's tab bar */}
      <nav style={{ display: "flex", gap: 8, padding: 12, background: "#1e1e2e" }}>
        <button
          onClick={() => setActiveTab("dashboard")}
          style={{
            padding: "8px 16px",
            background: activeTab === "dashboard" ? "#6366f1" : "#374151",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab("workflows")}
          style={{
            padding: "8px 16px",
            background: activeTab === "workflows" ? "#6366f1" : "#374151",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Workflows
        </button>
      </nav>

      {/* Tab content */}
      <div style={{ flex: 1 }}>
        {activeTab === "dashboard" && (
          <div style={{ padding: 24 }}>
            <h1>Your Dashboard</h1>
            <p>Your app content here...</p>
          </div>
        )}
        {activeTab === "workflows" && (
          <WorkflowApp
            apiUrl="https://app.zuzuflow.com/api"
            token="your-jwt-token"
          />
        )}
      </div>
    </div>
  );
}
