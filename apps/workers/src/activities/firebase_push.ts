import * as admin from "firebase-admin";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { FirebasePushConfig } from "@workflow/shared";

// =============================================================================
// firebasePushActivity — sends a push notification via Firebase Cloud Messaging
// =============================================================================

export interface FirebasePushActivityInput {
  config: FirebasePushConfig;
  context: Record<string, unknown>;
  resolvedServiceAccountJson?: string;
}

export interface FirebasePushActivityOutput {
  messageId: string;
  target: string;
  targetType: "token" | "topic";
}

export async function firebasePushActivity(
  input: FirebasePushActivityInput
): Promise<FirebasePushActivityOutput> {
  const { config: cfg, context, resolvedServiceAccountJson } = input;

  if (!resolvedServiceAccountJson) {
    throw ApplicationFailure.create({
      message: "Firebase Push: service account JSON is required",
      type: "FIREBASE_CONFIG_ERROR",
      nonRetryable: true,
    });
  }

  let serviceAccount: admin.ServiceAccount;
  try {
    serviceAccount = JSON.parse(resolvedServiceAccountJson) as admin.ServiceAccount;
  } catch {
    throw ApplicationFailure.create({
      message: "Firebase Push: failed to parse service account JSON",
      type: "FIREBASE_CONFIG_ERROR",
      nonRetryable: true,
    });
  }

  // Lazily initialize the Firebase app
  const app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

  const target = interpolateTemplate(cfg.target, context);
  const title = interpolateTemplate(cfg.title, context);
  const body = interpolateTemplate(cfg.body, context);
  const data = cfg.data ? interpolateTemplate(cfg.data, context) : undefined;
  const imageUrl = cfg.imageUrl ? interpolateTemplate(cfg.imageUrl, context) : undefined;

  const notification: admin.messaging.Notification = { title, body };
  if (imageUrl) {
    notification.imageUrl = imageUrl;
  }

  const message: admin.messaging.Message = {
    notification,
    ...(cfg.targetType === "topic" ? { topic: target } : { token: target }),
    ...(data ? { data: JSON.parse(data) } : {}),
  };

  try {
    const messageId = await admin.messaging(app).send(message);
    return { messageId, target, targetType: cfg.targetType };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Firebase Push failed: ${(err as Error).message}`,
      type: "FIREBASE_PUSH_ERROR",
      nonRetryable: false,
    });
  }
}
