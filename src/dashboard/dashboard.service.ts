import { Injectable } from '@nestjs/common';

@Injectable()
export class DashboardService {
  getDashboardHtml(): string {
    return `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TitanPaaS - Dashboard Web</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
  <style>
    :root {
      --bg-base: #090d16;
      --bg-card: #0f172a;
      --bg-card-hover: #1e293b;
      --border-color: #334155;
      --border-focus: #10b981;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #10b981;
      --primary-hover: #059669;
      --primary-glow: rgba(16, 185, 129, 0.25);
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.25);
      --danger: #ef4444;
      --warning: #f59e0b;
      --radius: 12px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-base);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    code, pre, .mono {
      font-family: 'JetBrains Mono', monospace;
    }

    /* Layout */
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 800;
      font-size: 1.25rem;
      letter-spacing: -0.025em;
      color: #fff;
    }

    .brand-badge {
      background: linear-gradient(135deg, #10b981, #3b82f6);
      color: #fff;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      box-shadow: 0 0 15px var(--primary-glow);
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-pill {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.8rem;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 9999px;
      font-size: 0.875rem;
    }

    .user-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.75rem;
      color: #000;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
      outline: none;
    }

    .btn-primary {
      background: var(--primary);
      color: #042f2e;
    }

    .btn-primary:hover {
      background: var(--primary-hover);
      box-shadow: 0 0 16px var(--primary-glow);
    }

    .btn-secondary {
      background: var(--bg-card);
      color: var(--text-main);
      border-color: var(--border-color);
    }

    .btn-secondary:hover {
      background: var(--bg-card-hover);
      border-color: #475569;
    }

    .btn-danger {
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
      border-color: rgba(239, 68, 68, 0.3);
    }

    .btn-danger:hover {
      background: var(--danger);
      color: #fff;
    }

    .btn-sm {
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
    }

    /* Container */
    .container {
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      flex: 1;
    }

    /* Cards */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 1.5rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }

    /* Auth Forms */
    .auth-container {
      max-width: 440px;
      margin: 3rem auto;
    }

    .auth-tabs {
      display: flex;
      background: #090d16;
      border-radius: 8px;
      padding: 4px;
      margin-bottom: 1.5rem;
      border: 1px solid var(--border-color);
    }

    .auth-tab {
      flex: 1;
      padding: 0.5rem;
      text-align: center;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.875rem;
      border-radius: 6px;
      color: var(--text-muted);
      transition: all 0.2s;
    }

    .auth-tab.active {
      background: var(--bg-card);
      color: var(--text-main);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    .form-group {
      margin-bottom: 1.25rem;
    }

    .form-label {
      display: block;
      margin-bottom: 0.4rem;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-muted);
    }

    .form-input {
      width: 100%;
      padding: 0.7rem 0.9rem;
      background: #090d16;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-main);
      font-size: 0.95rem;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--border-focus);
      box-shadow: 0 0 0 3px var(--primary-glow);
    }

    /* Dashboard Header */
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .dashboard-title h1 {
      font-size: 1.75rem;
      font-weight: 800;
      letter-spacing: -0.025em;
    }

    .dashboard-title p {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-top: 0.25rem;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 1.25rem;
      position: relative;
      overflow: hidden;
    }

    .stat-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, var(--primary), var(--accent));
    }

    .stat-label {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 800;
      margin-top: 0.4rem;
      color: #fff;
    }

    /* Projects Grid */
    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 1.5rem;
    }

    .project-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s, border-color 0.2s;
    }

    .project-card:hover {
      border-color: #475569;
      transform: translateY(-2px);
    }

    .project-card.active-metrics {
      border-color: var(--primary);
      box-shadow: 0 0 20px var(--primary-glow);
    }

    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .project-name {
      font-size: 1.25rem;
      font-weight: 700;
    }

    .project-repo {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .status-running {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .status-stopped {
      background: rgba(148, 163, 184, 0.15);
      color: #cbd5e1;
      border: 1px solid rgba(148, 163, 184, 0.3);
    }

    .status-pulse {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
    }

    .project-meta {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
      margin: 1rem 0;
      padding: 0.75rem;
      background: #090d16;
      border-radius: 8px;
      font-size: 0.8rem;
    }

    .project-meta-item span {
      display: block;
      color: var(--text-muted);
      font-size: 0.7rem;
      text-transform: uppercase;
    }

    .project-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }

    /* Real-Time Metrics Panel */
    .metrics-panel {
      margin-top: 2rem;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 1.5rem;
    }

    .metrics-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .metrics-title {
      font-size: 1.25rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .live-indicator {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 700;
      color: #34d399;
      background: rgba(16, 185, 129, 0.12);
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .metric-gauge-card {
      background: #090d16;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 1.25rem;
      position: relative;
    }

    .gauge-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .gauge-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .gauge-val {
      font-size: 1.5rem;
      font-weight: 800;
    }

    .progress-bar-bg {
      width: 100%;
      height: 10px;
      background: #1e293b;
      border-radius: 9999px;
      overflow: hidden;
      margin: 0.75rem 0;
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: 9999px;
      transition: width 0.4s ease;
      background: linear-gradient(90deg, #10b981, #3b82f6);
    }

    .progress-bar-fill.warning {
      background: linear-gradient(90deg, #f59e0b, #ef4444);
    }

    .gauge-detail {
      font-size: 0.8rem;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    .modal-overlay.open {
      opacity: 1;
      pointer-events: auto;
    }

    .modal-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      width: 90%;
      max-width: 540px;
      padding: 2rem;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 700;
    }

    .modal-close {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 1.5rem;
      cursor: pointer;
    }

    /* Alert / Toast */
    .toast {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: #fff;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      font-size: 0.875rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      z-index: 200;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s ease;
    }

    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }

    .toast-success { border-color: var(--primary); }
    .toast-error { border-color: var(--danger); }
  </style>
</head>
<body>
  <!-- Header / Navigation -->
  <header class="navbar">
    <div class="brand">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#10b981"/>
      </svg>
      TitanPaaS <span class="brand-badge">Dashboard</span>
    </div>
    <div class="nav-actions" id="navActions">
      <a href="/docs" target="_blank" class="btn btn-secondary btn-sm">Swagger API</a>
      <div id="authNavProfile" style="display: none;" class="user-pill">
        <div class="user-avatar" id="userInitial">U</div>
        <span id="userName">Usuario</span>
        <button class="btn btn-danger btn-sm" id="logoutBtn" style="margin-left: 0.5rem; padding: 0.2rem 0.5rem;">Salir</button>
      </div>
    </div>
  </header>

  <!-- Main Content Container -->
  <main class="container">
    <!-- Auth Section (Shown when logged out) -->
    <section id="authSection" class="auth-container card">
      <div class="auth-tabs">
        <div class="auth-tab active" id="tabLogin" onclick="switchAuthTab('login')">Iniciar Sesión</div>
        <div class="auth-tab" id="tabRegister" onclick="switchAuthTab('register')">Registrarse</div>
      </div>

      <!-- Login Form -->
      <form id="loginForm" onsubmit="handleLogin(event)">
        <div class="form-group">
          <label class="form-label">Correo Electrónico</label>
          <input type="email" id="loginEmail" class="form-input" required placeholder="admin@titanpaas.dev">
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <input type="password" id="loginPassword" class="form-input" required placeholder="••••••••">
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;" id="loginSubmitBtn">
          Entrar al Panel
        </button>
        <button type="button" class="btn btn-secondary" style="width: 100%; margin-top: 0.75rem;" onclick="handleGithubLogin()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Continuar con GitHub
        </button>
      </form>

      <!-- Register Form -->
      <form id="registerForm" onsubmit="handleRegister(event)" style="display: none;">
        <div class="form-group">
          <label class="form-label">Nombre Completo</label>
          <input type="text" id="regName" class="form-input" required placeholder="Alexander Garcia">
        </div>
        <div class="form-group">
          <label class="form-label">Correo Electrónico</label>
          <input type="email" id="regEmail" class="form-input" required placeholder="alex@ejemplo.com">
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <input type="password" id="regPassword" class="form-input" required placeholder="Mínimo 6 caracteres">
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;" id="regSubmitBtn">
          Crear Cuenta
        </button>
      </form>
    </section>

    <!-- Dashboard App Section (Shown when logged in) -->
    <section id="dashboardSection" style="display: none;">
      <!-- Dashboard Header -->
      <div class="dashboard-header">
        <div class="dashboard-title">
          <h1>Panel de Proyectos</h1>
          <p>Gestiona y monitorea tus aplicaciones desplegadas en TitanPaaS en tiempo real.</p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-secondary" onclick="loadProjects()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Refrescar
          </button>
          <button class="btn btn-primary" onclick="openCreateProjectModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nuevo Proyecto
          </button>
        </div>
      </div>

      <!-- Stats Summary -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Proyectos</div>
          <div class="stat-value" id="statTotalProjects">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Contenedores Activos</div>
          <div class="stat-value" style="color: #34d399;" id="statRunningContainers">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Estado de la Plataforma</div>
          <div class="stat-value" style="font-size: 1.4rem; color: #38bdf8;" id="statSystemHealth">Online</div>
        </div>
      </div>

      <!-- Projects Grid -->
      <div class="projects-grid" id="projectsContainer">
        <!-- Rendered via JS -->
      </div>

      <!-- Real-Time Hardware Metrics Section -->
      <div class="metrics-panel" id="metricsPanel" style="display: none;">
        <div class="metrics-header">
          <div class="metrics-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="#10b981"/>
            </svg>
            Métricas en Tiempo Real: <span id="metricsProjectTitle" style="color: var(--primary); margin-left: 0.5rem;"></span>
          </div>
          <div class="live-indicator">
            <div class="live-dot"></div>
            WebSocket Conectado (/metrics)
          </div>
        </div>

        <div class="metrics-grid">
          <!-- CPU Metric -->
          <div class="metric-gauge-card">
            <div class="gauge-top">
              <span class="gauge-label">Uso de CPU</span>
              <span class="gauge-val" id="metricCpuVal">0%</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="metricCpuBar" style="width: 0%;"></div>
            </div>
            <div class="gauge-detail">
              <span>Procesos (PIDs): <strong id="metricPids">0</strong></span>
              <span id="metricCpuStatus">Normal</span>
            </div>
          </div>

          <!-- RAM / Memory Metric -->
          <div class="metric-gauge-card">
            <div class="gauge-top">
              <span class="gauge-label">Memoria RAM</span>
              <span class="gauge-val" id="metricMemVal">0%</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="metricMemBar" style="width: 0%;"></div>
            </div>
            <div class="gauge-detail">
              <span>Consumo: <strong id="metricMemUsage">0 MiB</strong></span>
              <span>Límite: <strong id="metricMemLimit">0 GiB</strong></span>
            </div>
          </div>

          <!-- Network IO Metric -->
          <div class="metric-gauge-card">
            <div class="gauge-top">
              <span class="gauge-label">Tráfico de Red (Net I/O)</span>
              <span class="gauge-val" style="font-size: 1.15rem; color: #38bdf8;" id="metricNetVal">0B / 0B</span>
            </div>
            <div class="gauge-detail" style="margin-top: 1rem;">
              <span>Entrada (In): <strong id="metricNetIn" style="color: #34d399;">0 B</strong></span>
              <span>Salida (Out): <strong id="metricNetOut" style="color: #60a5fa;">0 B</strong></span>
            </div>
            <div class="gauge-detail" style="margin-top: 0.5rem;">
              <span>Block I/O: <strong id="metricBlockIo">0B / 0B</strong></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- Create Project Modal -->
  <div class="modal-overlay" id="createModal">
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title">Crear Nuevo Proyecto</h3>
        <button class="modal-close" onclick="closeCreateProjectModal()">&times;</button>
      </div>
      <form id="createProjectForm" onsubmit="handleCreateProject(event)">
        <div class="form-group">
          <label class="form-label">Nombre del Proyecto *</label>
          <input type="text" id="projName" class="form-input" required placeholder="mi-aplicacion-web">
        </div>
        <div class="form-group">
          <label class="form-label">Repositorio de GitHub *</label>
          <input type="text" id="projRepo" class="form-input" required placeholder="usuario/repositorio">
        </div>
        <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label class="form-label">Rama (Branch)</label>
            <input type="text" id="projBranch" class="form-input" value="main" placeholder="main">
          </div>
          <div>
            <label class="form-label">Puerto del Contenedor</label>
            <input type="number" id="projPort" class="form-input" value="3000" placeholder="3000">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Variables de Entorno (JSON o KEY=VAL por línea)</label>
          <textarea id="projEnv" class="form-input mono" rows="3" placeholder="NODE_ENV=production&#10;API_KEY=xyz"></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="closeCreateProjectModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="createProjSubmitBtn">Crear y Desplegar</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Toast Notification -->
  <div class="toast" id="toastNotification">
    <span id="toastMessage">Operación completada</span>
  </div>

  <!-- Interactive JavaScript Logic -->
  <script>
    let currentToken = localStorage.getItem('titan_paas_token');
    let currentUser = null;
    let projectsList = [];
    let activeMetricsProjectId = null;
    let metricsSocket = null;

    // Toast utility
    function showToast(message, type = 'success') {
      const toast = document.getElementById('toastNotification');
      const msg = document.getElementById('toastMessage');
      msg.textContent = message;
      toast.className = 'toast show ' + (type === 'error' ? 'toast-error' : 'toast-success');
      setTimeout(() => {
        toast.className = 'toast';
      }, 3500);
    }

    // Auth Tabs
    function switchAuthTab(tab) {
      const tabLogin = document.getElementById('tabLogin');
      const tabRegister = document.getElementById('tabRegister');
      const loginForm = document.getElementById('loginForm');
      const registerForm = document.getElementById('registerForm');

      if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
      } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerForm.style.display = 'block';
        loginForm.style.display = 'none';
      }
    }

    // Login Handler
    async function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const btn = document.getElementById('loginSubmitBtn');

      try {
        btn.disabled = true;
        btn.textContent = 'Autenticando...';

        const res = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Error al iniciar sesión');
        }

        currentToken = data.access_token;
        localStorage.setItem('titan_paas_token', currentToken);
        showToast('Bienvenido a TitanPaaS');
        initSession();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar al Panel';
      }
    }

    // Register Handler
    async function handleRegister(e) {
      e.preventDefault();
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const btn = document.getElementById('regSubmitBtn');

      try {
        btn.disabled = true;
        btn.textContent = 'Creando cuenta...';

        const res = await fetch('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Error al registrar usuario');
        }

        currentToken = data.access_token;
        localStorage.setItem('titan_paas_token', currentToken);
        showToast('Cuenta creada exitosamente');
        initSession();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Crear Cuenta';
      }
    }

    // GitHub OAuth
    function handleGithubLogin() {
      const redirectUri = window.location.origin + '/dashboard';
      window.location.href =
        '/auth/github?redirectUri=' + encodeURIComponent(redirectUri);
    }

    // Logout
    function handleLogout() {
      localStorage.removeItem('titan_paas_token');
      currentToken = null;
      currentUser = null;
      if (metricsSocket) {
        metricsSocket.disconnect();
      }
      document.getElementById('authNavProfile').style.display = 'none';
      document.getElementById('authSection').style.display = 'block';
      document.getElementById('dashboardSection').style.display = 'none';
      showToast('Sesión cerrada');
    }

    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Init Session
    async function initSession() {
      // Check if redirected from GitHub OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        currentToken = urlToken;
        localStorage.setItem('titan_paas_token', currentToken);
        window.history.replaceState({}, document.title, window.location.pathname);
        showToast('Sesión iniciada con GitHub');
      }

      if (!currentToken) {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('dashboardSection').style.display = 'none';
        document.getElementById('authNavProfile').style.display = 'none';
        return;
      }

      try {
        const res = await fetch('/auth/profile', {
          headers: { 'Authorization': 'Bearer ' + currentToken }
        });

        if (!res.ok) {
          handleLogout();
          return;
        }

        currentUser = await res.json();
        document.getElementById('userName').textContent = currentUser.name || currentUser.email;
        document.getElementById('userInitial').textContent = (currentUser.name || currentUser.email).charAt(0).toUpperCase();
        document.getElementById('authNavProfile').style.display = 'flex';
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'block';

        loadProjects();
        checkSystemHealth();
        setupMetricsSocket();
      } catch (err) {
        handleLogout();
      }
    }

    // Load Projects
    async function loadProjects() {
      try {
        const res = await fetch('/projects', {
          headers: { 'Authorization': 'Bearer ' + currentToken }
        });

        if (!res.ok) throw new Error('Error al obtener proyectos');
        projectsList = await res.json();
        renderProjects();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    // System Health Check
    async function checkSystemHealth() {
      try {
        const res = await fetch('/system/health');
        if (res.ok) {
          const health = await res.json();
          document.getElementById('statSystemHealth').textContent = health.status === 'ok' ? 'Operativo' : 'Degradado';
        }
      } catch {
        document.getElementById('statSystemHealth').textContent = 'Online';
      }
    }

    // Render Projects
    function renderProjects() {
      const container = document.getElementById('projectsContainer');
      document.getElementById('statTotalProjects').textContent = projectsList.length;

      let runningCount = 0;
      if (projectsList.length === 0) {
        container.innerHTML = \`
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border-color);">
            <h3 style="font-size: 1.15rem; margin-bottom: 0.5rem;">No tienes proyectos registrados</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">Crea tu primer proyecto para desplegarlo en contenedores Docker y monitorear sus métricas.</p>
            <button class="btn btn-primary" onclick="openCreateProjectModal()">Crear Proyecto Ahora</button>
          </div>
        \`;
        document.getElementById('statRunningContainers').textContent = '0';
        return;
      }

      container.innerHTML = projectsList.map(p => {
        const isRunning = p.status === 'DEPLOYED' || p.containerStatus === 'running';
        if (isRunning) runningCount++;
        const isSelected = activeMetricsProjectId === p.id;

        return \`
          <div class="project-card \${isSelected ? 'active-metrics' : ''}" id="project-card-\${p.id}">
            <div>
              <div class="project-header">
                <div>
                  <div class="project-name">\${escapeHtml(p.name)}</div>
                  <div class="project-repo">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                    \${escapeHtml(p.repositoryName)}
                  </div>
                </div>
                <span class="status-badge \${isRunning ? 'status-running' : 'status-stopped'}">
                  <span class="status-pulse"></span>
                  \${isRunning ? 'RUNNING' : 'STOPPED'}
                </span>
              </div>

              <div class="project-meta">
                <div class="project-meta-item">
                  <span>Rama</span>
                  <strong>\${escapeHtml(p.branch || 'main')}</strong>
                </div>
                <div class="project-meta-item">
                  <span>Puerto</span>
                  <strong>\${p.port || 3000}</strong>
                </div>
              </div>
            </div>

            <div class="project-actions">
              <button class="btn btn-primary btn-sm" onclick="selectProjectMetrics('\${p.id}', '\${escapeHtml(p.name)}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Métricas
              </button>
              <button class="btn btn-secondary btn-sm" onclick="triggerDeploy('\${p.id}')">Deploy</button>
              \${isRunning ? 
                \`<button class="btn btn-secondary btn-sm" onclick="controlProject('\${p.id}', 'stop')">Stop</button>\` : 
                \`<button class="btn btn-secondary btn-sm" onclick="controlProject('\${p.id}', 'start')">Start</button>\`
              }
              <button class="btn btn-secondary btn-sm" onclick="controlProject('\${p.id}', 'restart')">Restart</button>
              <button class="btn btn-danger btn-sm" onclick="deleteProject('\${p.id}')">Borrar</button>
            </div>
          </div>
        \`;
      }).join('');

      document.getElementById('statRunningContainers').textContent = runningCount;

      // Auto-select first project metrics if none selected
      if (!activeMetricsProjectId && projectsList.length > 0) {
        selectProjectMetrics(projectsList[0].id, projectsList[0].name);
      }
    }

    // Modal Create Project
    function openCreateProjectModal() {
      document.getElementById('createModal').classList.add('open');
    }

    function closeCreateProjectModal() {
      document.getElementById('createModal').classList.remove('open');
    }

    // Handle Create Project
    async function handleCreateProject(e) {
      e.preventDefault();
      const name = document.getElementById('projName').value.trim();
      const repositoryName = document.getElementById('projRepo').value.trim();
      const branch = document.getElementById('projBranch').value.trim() || 'main';
      const port = parseInt(document.getElementById('projPort').value, 10) || 3000;
      const rawEnv = document.getElementById('projEnv').value.trim();
      const btn = document.getElementById('createProjSubmitBtn');

      let envVariables = {};
      if (rawEnv) {
        try {
          if (rawEnv.startsWith('{')) {
            envVariables = JSON.parse(rawEnv);
          } else {
            rawEnv.split('\\n').forEach(line => {
              const parts = line.split('=');
              if (parts.length >= 2) {
                envVariables[parts[0].trim()] = parts.slice(1).join('=').trim();
              }
            });
          }
        } catch {
          showToast('Formato de variables de entorno inválido', 'error');
          return;
        }
      }

      try {
        btn.disabled = true;
        btn.textContent = 'Creando...';

        const res = await fetch('/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + currentToken
          },
          body: JSON.stringify({ name, repositoryName, branch, port, envVariables })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al crear proyecto');

        showToast('Proyecto creado exitosamente');
        closeCreateProjectModal();
        document.getElementById('createProjectForm').reset();
        await loadProjects();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Crear y Desplegar';
      }
    }

    // Control Container (start, stop, restart)
    async function controlProject(id, action) {
      try {
        const res = await fetch(\`/projects/\${id}/\${action}\`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || \`Error al ejecutar \${action}\`);
        showToast(\`Acción \${action} ejecutada exitosamente\`);
        await loadProjects();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    // Trigger Deploy
    async function triggerDeploy(projectId) {
      try {
        const res = await fetch('/deployments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + currentToken
          },
          body: JSON.stringify({ projectId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al disparar despliegue');
        showToast('Despliegue encolado');
        loadProjects();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    // Delete Project
    async function deleteProject(id) {
      if (!confirm('¿Estás seguro de eliminar este proyecto?')) return;
      try {
        const res = await fetch(\`/projects/\${id}\`, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (!res.ok) throw new Error('Error al eliminar proyecto');
        showToast('Proyecto eliminado');
        loadProjects();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    // Real-Time Metrics via WebSocket (/metrics)
    function setupMetricsSocket() {
      if (metricsSocket) return;
      try {
        metricsSocket = io('/metrics', {
          transports: ['websocket', 'polling']
        });

        metricsSocket.on('connect', () => {
          console.log('[Dashboard] Conectado al namespace /metrics');
          if (activeMetricsProjectId) {
            metricsSocket.emit('joinProject', { projectId: activeMetricsProjectId });
          }
        });

        metricsSocket.on('metrics:update', handleMetricsUpdate);
        metricsSocket.on('metrics', handleMetricsUpdate);

        metricsSocket.on('disconnect', () => {
          console.log('[Dashboard] Desconectado de /metrics');
        });
      } catch (e) {
        console.warn('Socket.io metrics error:', e);
      }
    }

    function selectProjectMetrics(projectId, projectName) {
      activeMetricsProjectId = projectId;
      document.getElementById('metricsPanel').style.display = 'block';
      document.getElementById('metricsProjectTitle').textContent = projectName;

      document.querySelectorAll('.project-card').forEach(el => el.classList.remove('active-metrics'));
      const activeCard = document.getElementById(\`project-card-\${projectId}\`);
      if (activeCard) activeCard.classList.add('active-metrics');

      if (metricsSocket && metricsSocket.connected) {
        metricsSocket.emit('joinProject', { projectId });
      }

      // Fetch immediate initial metrics via REST if available
      fetchProjectMetricsRest(projectId);
    }

    async function fetchProjectMetricsRest(projectId) {
      try {
        const res = await fetch('/metrics', {
          headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            handleMetricsUpdate(list[0]);
          }
        }
      } catch {}
    }

    function handleMetricsUpdate(data) {
      if (!data) return;

      // Update CPU
      const cpu = Math.min(100, Math.max(0, data.cpuPercentage || 0));
      document.getElementById('metricCpuVal').textContent = cpu.toFixed(1) + '%';
      const cpuBar = document.getElementById('metricCpuBar');
      cpuBar.style.width = cpu + '%';
      cpuBar.className = 'progress-bar-fill' + (cpu > 80 ? ' warning' : '');
      document.getElementById('metricPids').textContent = data.pids || 0;
      document.getElementById('metricCpuStatus').textContent = cpu > 80 ? 'Alto Uso' : 'Normal';

      // Update RAM
      const mem = Math.min(100, Math.max(0, data.memoryPercentage || 0));
      document.getElementById('metricMemVal').textContent = mem.toFixed(1) + '%';
      const memBar = document.getElementById('metricMemBar');
      memBar.style.width = mem + '%';
      memBar.className = 'progress-bar-fill' + (mem > 85 ? ' warning' : '');
      document.getElementById('metricMemUsage').textContent = data.memoryUsage || '0 MiB';
      document.getElementById('metricMemLimit').textContent = data.memoryLimit || '0 GiB';

      // Update Network IO
      const netIn = data.networkInput || '0 B';
      const netOut = data.networkOutput || '0 B';
      document.getElementById('metricNetVal').textContent = \`\${netIn} / \${netOut}\`;
      document.getElementById('metricNetIn').textContent = netIn;
      document.getElementById('metricNetOut').textContent = netOut;

      const blockIn = data.blockInput || '0 B';
      const blockOut = data.blockOutput || '0 B';
      document.getElementById('metricBlockIo').textContent = \`\${blockIn} / \${blockOut}\`;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // Auto-bootstrap
    window.addEventListener('DOMContentLoaded', initSession);
  </script>
</body>
</html>`;
  }
}
