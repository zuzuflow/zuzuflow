import "dotenv/config";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { config } from "./config";
import { logger } from "./logger";

// =============================================================================
// Temporal Worker — registers the GraphInterpreter workflow and all activities
//
// Supports multi-queue operation:
//   • TEMPORAL_TASK_QUEUE=workflow-interpreter               → single queue (default)
//   • TEMPORAL_TASK_QUEUES=shared-free,premium-pool,org-abc  → multiple queues,
//                                                              one Worker per
//                                                              queue, all polling
//                                                              in parallel
//
// Use the plural env var when self-hosting a modest multi-tenant install where
// you want one worker pod covering multiple tiers. For large isolation needs,
// run separate worker Deployments (one per task queue) instead — that's what
// the `zuzuflow-admin` provisioner does for SaaS.
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

  // Resolve the list of queues this process will poll. Plural wins if set;
  // falls back to the singular. De-duped to avoid double-registering the
  // same queue.
  const queues = (
    config.TEMPORAL_TASK_QUEUES
      ? config.TEMPORAL_TASK_QUEUES.split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [config.TEMPORAL_TASK_QUEUE]
  );
  const uniqueQueues = Array.from(new Set(queues));

  logger.info("Temporal worker starting", {
    address: config.TEMPORAL_ADDRESS,
    namespace: config.TEMPORAL_NAMESPACE,
    queues: uniqueQueues,
  });

  const workerPromises: Array<Promise<void>> = [];

  for (const taskQueue of uniqueQueues) {
    const worker = await Worker.create({
      connection,
      namespace: config.TEMPORAL_NAMESPACE,
      taskQueue,
      // The workflow bundle path — Temporal compiles this into an isolated bundle.
      workflowsPath: require.resolve("./workflows/GraphInterpreter"),
      activities,
      maxConcurrentActivityTaskExecutions: 20,
      maxConcurrentWorkflowTaskExecutions: 10,
    });
    logger.info("Polling queue", { taskQueue });
    // Run each worker concurrently. worker.run() returns a promise that only
    // resolves when the worker shuts down, so we collect them and Promise.all
    // below to wait on all of them.
    workerPromises.push(worker.run());
  }

  await Promise.all(workerPromises);
}

main().catch((err) => {
  logger.error("Worker crashed", { err });
  process.exit(1);
});
