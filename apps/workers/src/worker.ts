import "dotenv/config";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { config } from "./config";
import { logger } from "./logger";

// =============================================================================
// Temporal Worker — registers the GraphInterpreter workflow and all activities
// =============================================================================

async function main() {
  const connection = await NativeConnection.connect({
    address: config.TEMPORAL_ADDRESS,
    // TLS configuration for production
    ...(config.TEMPORAL_TLS_CERT_PATH && config.TEMPORAL_TLS_KEY_PATH
      ? {
          tls: {
            clientCertPair: {
              crt: require("fs").readFileSync(config.TEMPORAL_TLS_CERT_PATH),
              key: require("fs").readFileSync(config.TEMPORAL_TLS_KEY_PATH),
            },
          },
        }
      : {}),
  });

  const worker = await Worker.create({
    connection,
    namespace: config.TEMPORAL_NAMESPACE,
    taskQueue: config.TEMPORAL_TASK_QUEUE,

    // The workflow bundle path — Temporal compiles this into an isolated bundle.
    // Using workflowsPath ensures only the workflow function is sandboxed.
    workflowsPath: require.resolve("./workflows/GraphInterpreter"),

    // All activities run in the normal Node.js environment
    activities,

    // Worker concurrency settings
    maxConcurrentActivityTaskExecutions: 20,
    maxConcurrentWorkflowTaskExecutions: 10,
  });

  logger.info("Temporal worker starting", {
    address: config.TEMPORAL_ADDRESS,
    namespace: config.TEMPORAL_NAMESPACE,
    taskQueue: config.TEMPORAL_TASK_QUEUE,
  });

  // Run the worker — this blocks until the process is killed
  await worker.run();
}

main().catch((err) => {
  logger.error("Worker crashed", { err });
  process.exit(1);
});
