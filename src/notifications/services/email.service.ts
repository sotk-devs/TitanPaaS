import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

export interface DeploymentFailureAlertOptions {
  to: string;
  userName?: string;
  projectId: string;
  projectName: string;
  repositoryName: string;
  deploymentId?: string;
  branch: string;
  commitSha: string;
  commitMessage?: string;
  author?: string;
  durationMs?: number;
  errorMessage?: string;
  timestamp?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  skipped?: boolean;
  error?: string;
}

export interface SmtpConfigOptions {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  appUrl?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly customTransporter?: Transporter;

  private enabled: boolean;
  private host: string;
  private port: number;
  private secure: boolean;
  private user: string;
  private pass: string;
  private from: string;
  private appUrl: string;

  constructor(options?: SmtpConfigOptions, transporterOverride?: Transporter) {
    this.customTransporter = transporterOverride;
    this.enabled =
      options?.enabled !== undefined
        ? options.enabled
        : process.env.SMTP_ENABLED === 'true';
    this.host = options?.host ?? process.env.SMTP_HOST ?? '';
    this.port =
      options?.port ??
      (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587);
    this.secure =
      options?.secure !== undefined
        ? options.secure
        : process.env.SMTP_SECURE === 'true';
    this.user = options?.user ?? process.env.SMTP_USER ?? '';
    this.pass = options?.pass ?? process.env.SMTP_PASS ?? '';
    this.from =
      options?.from ??
      process.env.SMTP_FROM ??
      'TitanPaaS <noreply@titanpaas.io>';
    this.appUrl =
      options?.appUrl ??
      process.env.APP_URL ??
      process.env.DASHBOARD_URL ??
      'http://localhost:3000';
  }

  isEnabled(): boolean {
    return this.enabled && Boolean(this.host);
  }

  getTransporter(): Transporter | null {
    if (this.customTransporter) {
      return this.customTransporter;
    }

    if (!this.isEnabled()) {
      return null;
    }

    if (!this.transporter) {
      const auth =
        this.user && this.pass
          ? { user: this.user, pass: this.pass }
          : undefined;

      this.transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.secure,
        auth,
      });
    }

    return this.transporter;
  }

  async sendDeploymentFailureAlert(
    options: DeploymentFailureAlertOptions,
  ): Promise<EmailSendResult> {
    if (!this.isEnabled()) {
      this.logger.debug(
        `[EmailService] Servicio SMTP deshabilitado o no configurado. Se omite el envio de alerta para ${options.projectName}`,
      );
      return { success: true, skipped: true };
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      return { success: true, skipped: true };
    }

    const shortCommit = options.commitSha
      ? options.commitSha.substring(0, 7)
      : 'HEAD';
    const duration =
      options.durationMs !== undefined
        ? `${(options.durationMs / 1000).toFixed(2)}s`
        : 'N/A';
    const timestamp = options.timestamp || new Date().toISOString();
    const dashboardLink = options.deploymentId
      ? `${this.appUrl}/projects/${options.projectId}/deployments/${options.deploymentId}`
      : `${this.appUrl}/projects/${options.projectId}`;

    const subject = `[TitanPaaS] Fallo en despliegue: ${options.projectName} (${options.branch})`;

    const textContent = this.generatePlainTextTemplate({
      ...options,
      shortCommit,
      duration,
      timestamp,
      dashboardLink,
    });

    const htmlContent = this.generateHtmlTemplate({
      ...options,
      shortCommit,
      duration,
      timestamp,
      dashboardLink,
    });

    try {
      const info = await transporter.sendMail({
        from: this.from,
        to: options.to,
        subject,
        text: textContent,
        html: htmlContent,
      });

      this.logger.log(
        `Alerta de fallo de despliegue enviada a ${options.to} para el proyecto ${options.projectName} (messageId: ${info.messageId})`,
      );

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error al enviar correo de alerta de fallo de despliegue a ${options.to}: ${errorMessage}`,
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private generatePlainTextTemplate(params: {
    userName?: string;
    projectName: string;
    repositoryName: string;
    branch: string;
    shortCommit: string;
    commitMessage?: string;
    author?: string;
    duration: string;
    timestamp: string;
    errorMessage?: string;
    dashboardLink: string;
  }): string {
    const greeting = params.userName
      ? `Hola ${params.userName},`
      : 'Estimado desarrollador,';

    const commitInfo = params.commitMessage
      ? `${params.shortCommit} - "${params.commitMessage}"`
      : params.shortCommit;

    return `
TitanPaaS - Alerta de Fallo en Despliegue

${greeting}

Se ha detectado un fallo critico durante el pipeline de despliegue de tu proyecto en TitanPaaS.

Detalles del Despliegue:
- Proyecto: ${params.projectName}
- Repositorio: ${params.repositoryName}
- Rama: ${params.branch}
- Commit: ${commitInfo}
- Autor: ${params.author || 'N/A'}
- Duracion: ${params.duration}
- Fecha y hora: ${params.timestamp}

Detalle del Error:
----------------------------------------
${params.errorMessage || 'No se proporciono un mensaje de error detallado.'}
----------------------------------------

Puedes consultar los logs completos y reintentar el despliegue desde el dashboard:
${params.dashboardLink}

--
TitanPaaS Notification System
Mensaje automatico, por favor no responder directamente a este correo.
`.trim();
  }

  private generateHtmlTemplate(params: {
    userName?: string;
    projectName: string;
    repositoryName: string;
    branch: string;
    shortCommit: string;
    commitMessage?: string;
    author?: string;
    duration: string;
    timestamp: string;
    errorMessage?: string;
    dashboardLink: string;
  }): string {
    const greeting = params.userName
      ? `Hola ${this.escapeHtml(params.userName)},`
      : 'Estimado desarrollador,';

    const commitLine = params.commitMessage
      ? `<code>${this.escapeHtml(params.shortCommit)}</code> - &ldquo;${this.escapeHtml(params.commitMessage)}&rdquo;`
      : `<code>${this.escapeHtml(params.shortCommit)}</code>`;

    const escapedError = params.errorMessage
      ? this.escapeHtml(params.errorMessage)
      : 'No se proporciono un mensaje de error detallado.';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fallo en despliegue</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0f172a;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
    }
    .wrapper {
      max-width: 600px;
      margin: 32px auto;
      background-color: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      background-color: #0f172a;
      padding: 24px 32px;
      border-bottom: 1px solid #334155;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-radius: 9999px;
      background-color: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border: 1px solid #ef4444;
    }
    .content {
      padding: 32px;
    }
    h1 {
      margin-top: 0;
      font-size: 20px;
      font-weight: 600;
      color: #f1f5f9;
    }
    p {
      margin: 0 0 16px 0;
      color: #94a3b8;
    }
    .table-container {
      margin: 20px 0;
      border: 1px solid #334155;
      border-radius: 6px;
      background-color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    td {
      padding: 10px 14px;
      border-bottom: 1px solid #1e293b;
    }
    tr:last-child td {
      border-bottom: none;
    }
    td.label {
      color: #64748b;
      font-weight: 500;
      width: 30%;
    }
    td.value {
      color: #f1f5f9;
      font-weight: 400;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      background-color: #1e293b;
      padding: 2px 6px;
      border-radius: 4px;
      color: #38bdf8;
    }
    .error-box {
      margin: 20px 0;
      background-color: #0b0f19;
      border-left: 4px solid #ef4444;
      border-radius: 0 6px 6px 0;
      padding: 16px;
    }
    .error-title {
      font-size: 12px;
      font-weight: 600;
      color: #f87171;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    pre {
      margin: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #fca5a5;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 240px;
      overflow-y: auto;
    }
    .actions {
      margin: 28px 0 12px 0;
      text-align: center;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 500;
      font-size: 14px;
    }
    .footer {
      background-color: #0f172a;
      padding: 20px 32px;
      border-top: 1px solid #334155;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="brand">TitanPaaS</span>
      <span class="badge">Fallo de Despliegue</span>
    </div>
    <div class="content">
      <h1>Alerta de Despliegue Fallido</h1>
      <p>${greeting}</p>
      <p>Se ha producido un error critico durante el proceso de construccion o ejecucion de tu aplicacion.</p>
      
      <div class="table-container">
        <table>
          <tr>
            <td class="label">Proyecto</td>
            <td class="value"><strong>${this.escapeHtml(params.projectName)}</strong></td>
          </tr>
          <tr>
            <td class="label">Repositorio</td>
            <td class="value">${this.escapeHtml(params.repositoryName)}</td>
          </tr>
          <tr>
            <td class="label">Rama</td>
            <td class="value"><code>${this.escapeHtml(params.branch)}</code></td>
          </tr>
          <tr>
            <td class="label">Commit</td>
            <td class="value">${commitLine}</td>
          </tr>
          ${params.author ? `<tr><td class="label">Autor</td><td class="value">${this.escapeHtml(params.author)}</td></tr>` : ''}
          <tr>
            <td class="label">Duracion</td>
            <td class="value">${this.escapeHtml(params.duration)}</td>
          </tr>
          <tr>
            <td class="label">Fecha</td>
            <td class="value">${this.escapeHtml(params.timestamp)}</td>
          </tr>
        </table>
      </div>

      <div class="error-box">
        <div class="error-title">Registro de Error</div>
        <pre>${escapedError}</pre>
      </div>

      <div class="actions">
        <a href="${this.escapeHtml(params.dashboardLink)}" class="button" target="_blank" rel="noopener noreferrer">Ver Despliegue en Dashboard</a>
      </div>
    </div>
    <div class="footer">
      TitanPaaS Platform &bull; Mensaje automatico de notificacion del sistema.
    </div>
  </div>
</body>
</html>
`.trim();
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
