import { Client as SshClient } from "ssh2";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { SshTerminalConfig } from "@workflow/shared";

// =============================================================================
// sshActivity — executes a command on a remote host over SSH
// =============================================================================

export interface SshActivityInput {
  config: SshTerminalConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { password?: string; privateKey?: string };
}

export interface SshActivityOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  ok: boolean;
}

export async function sshActivity(
  input: SshActivityInput
): Promise<SshActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const host = interpolateTemplate(cfg.host, context);
  const command = interpolateTemplate(cfg.command, context);
  const port = cfg.port ?? 22;
  const username = interpolateTemplate(cfg.username, context);
  const timeoutMs = (cfg.timeout ?? 30) * 1000;

  const password =
    resolvedCredentials?.password ??
    (cfg.password ? interpolateTemplate(cfg.password, context) : undefined);
  const privateKey =
    resolvedCredentials?.privateKey ??
    (cfg.privateKey ? cfg.privateKey : undefined);

  if (!password && !privateKey) {
    throw ApplicationFailure.create({
      message: "SSH: no password or private key provided",
      type: "SSH_CONFIG_ERROR",
      nonRetryable: true,
    });
  }

  return new Promise<SshActivityOutput>((resolve, reject) => {
    const conn = new SshClient();
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      conn.end();
      reject(
        ApplicationFailure.create({
          message: `SSH command timed out after ${cfg.timeout ?? 30}s`,
          type: "SSH_TIMEOUT",
          nonRetryable: true,
        })
      );
    }, timeoutMs);

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          conn.end();
          return reject(
            ApplicationFailure.create({
              message: `SSH exec failed: ${err.message}`,
              type: "SSH_EXEC_ERROR",
              nonRetryable: false,
            })
          );
        }

        stream
          .on("close", (code: number | null) => {
            clearTimeout(timer);
            conn.end();
            resolve({
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              exitCode: code,
              ok: code === 0,
            });
          })
          .on("data", (data: Buffer) => {
            stdout += data.toString();
          })
          .stderr.on("data", (data: Buffer) => {
            stderr += data.toString();
          });
      });
    });

    conn.on("error", (err) => {
      clearTimeout(timer);
      reject(
        ApplicationFailure.create({
          message: `SSH connection failed: ${err.message}`,
          type: "SSH_CONNECTION_ERROR",
          nonRetryable: false,
        })
      );
    });

    conn.connect({
      host,
      port,
      username,
      ...(password ? { password } : {}),
      ...(privateKey ? { privateKey } : {}),
      readyTimeout: timeoutMs,
    });
  });
}
