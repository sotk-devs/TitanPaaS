import { NotificationEvent } from '../enums/notification-event.enum.js';

export interface DeploymentNotificationPayload {
  event: NotificationEvent;
  projectId: string;
  projectName: string;
  repositoryName: string;
  deploymentId?: string;
  branch: string;
  commitSha: string;
  commitMessage?: string;
  author?: string;
  userEmail?: string;
  userName?: string;
  url?: string;
  durationMs?: number;
  errorMessage?: string;
  timestamp: string;
}

export interface WebhookDeliveryResult {
  webhookId: string;
  delivered: boolean;
  statusCode?: number;
  error?: string;
}
