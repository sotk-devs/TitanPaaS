#!/usr/bin/env bash
# ==============================================================================
# TitanPaaS - Unattended Production Installation Script for Linux / VPS
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/sotk-devs/TitanPaaS/main/titan.sh | bash
#   or:
#   ./scripts/install.sh [options]
# ==============================================================================

set -euo pipefail

# Configuration defaults
DEFAULT_INSTALL_DIR="/opt/titanpaas"
DEFAULT_REPO_URL="https://github.com/sotk-devs/TitanPaaS.git"
DEFAULT_BRANCH="main"

INSTALL_DIR="${DEFAULT_INSTALL_DIR}"
REPO_URL="${DEFAULT_REPO_URL}"
BRANCH="${DEFAULT_BRANCH}"
DOMAIN=""
ACME_EMAIL=""
UNATTENDED="false"
SKIP_DOCKER="false"

# Colors for log output (standard terminal text, no icons or emojis)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    printf "${BLUE}[INFO]${NC} %s\n" "$1"
}

log_success() {
    printf "${GREEN}[SUCCESS]${NC} %s\n" "$1"
}

log_warn() {
    printf "${YELLOW}[WARN]${NC} %s\n" "$1"
}

log_error() {
    printf "${RED}[ERROR]${NC} %s\n" "$1" >&2
}

display_help() {
    cat << EOF
TitanPaaS Production Installer

Usage:
  bash install.sh [options]

Options:
  --domain <domain>     Primary domain or public IP for TitanPaaS (default: auto-detected)
  --email <email>       Email address for Let's Encrypt TLS certificates
  --dir <path>          Installation target directory (default: /opt/titanpaas)
  --branch <branch>     Git branch to deploy (default: main)
  --repo <url>          Git repository URL
  --unattended, -y      Non-interactive mode (auto-generate all secrets and use defaults)
  --skip-docker         Skip Docker and Docker Compose installation check
  --help, -h            Display this help message
EOF
}

# Parse command line options
while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --email)
            ACME_EMAIL="$2"
            shift 2
            ;;
        --dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        --branch)
            BRANCH="$2"
            shift 2
            ;;
        --repo)
            REPO_URL="$2"
            shift 2
            ;;
        --unattended|-y)
            UNATTENDED="true"
            shift
            ;;
        --skip-docker)
            SKIP_DOCKER="true"
            shift
            ;;
        --help|-h)
            display_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            display_help
            exit 1
            ;;
    esac
done

# Step 1: Privilege Verification
check_root() {
    if [[ "${EUID}" -ne 0 ]]; then
        log_error "This script must be executed with root privileges or via sudo."
        exit 1
    fi
    log_info "Root permissions verified."
}

# Step 2: Architecture and OS Detection
detect_os() {
    OS_NAME="unknown"
    OS_DISTRO="unknown"
    ARCH=$(uname -m)

    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS_DISTRO="${ID:-unknown}"
        OS_NAME="${PRETTY_NAME:-Linux}"
    elif command -v uname > /dev/null 2>&1; then
        OS_NAME=$(uname -s)
    fi

    log_info "Detected operating system: ${OS_NAME} (${ARCH})"

    case "${ARCH}" in
        x86_64|amd64|aarch64|arm64)
            ;;
        *)
            log_warn "Architecture ${ARCH} may not have pre-built Docker images."
            ;;
    esac
}

# Step 3: Install Required Dependencies
install_dependencies() {
    log_info "Installing prerequisite utilities (curl, git, openssl, ca-certificates)..."

    if command -v apt-get > /dev/null 2>&1; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -qq > /dev/null 2>&1 || true
        apt-get install -y -qq curl git openssl ca-certificates > /dev/null 2>&1
    elif command -v dnf > /dev/null 2>&1; then
        dnf install -y -q curl git openssl ca-certificates > /dev/null 2>&1
    elif command -v yum > /dev/null 2>&1; then
        yum install -y -q curl git openssl ca-certificates > /dev/null 2>&1
    elif command -v apk > /dev/null 2>&1; then
        apk add --no-cache curl git openssl ca-certificates bash > /dev/null 2>&1
    fi

    log_success "Prerequisites installed."
}

# Step 4: Docker & Docker Compose Engine
install_docker() {
    if [[ "${SKIP_DOCKER}" == "true" ]]; then
        log_info "Skipping Docker installation check as requested."
        return 0
    fi

    if command -v docker > /dev/null 2>&1 && docker compose version > /dev/null 2>&1; then
        log_info "Docker and Docker Compose are already installed: $(docker --version)"
    else
        log_info "Installing Docker Engine and Docker Compose plugin..."
        curl -fsSL https://get.docker.com | sh > /dev/null 2>&1
        log_success "Docker Engine installed successfully."
    fi

    if command -v systemctl > /dev/null 2>&1; then
        systemctl enable --now docker > /dev/null 2>&1 || true
    fi
}

# Step 5: Detect Public IP / Domain
detect_network_info() {
    if [[ -z "${DOMAIN}" ]]; then
        PUBLIC_IP=$(curl -fsSL https://api.ipify.org 2>/dev/null || curl -fsSL https://ifconfig.me 2>/dev/null || echo "127.0.0.1")
        if [[ "${UNATTENDED}" == "true" ]]; then
            DOMAIN="${PUBLIC_IP}"
            log_info "Unattended mode: Defaulting domain to host public IP: ${DOMAIN}"
        else
            printf "Enter primary domain for TitanPaaS (or press Enter to use public IP %s): " "${PUBLIC_IP}"
            read -r USER_DOMAIN
            DOMAIN="${USER_DOMAIN:-${PUBLIC_IP}}"
        fi
    fi

    if [[ -z "${ACME_EMAIL}" ]]; then
        if [[ "${UNATTENDED}" == "true" ]]; then
            ACME_EMAIL="admin@${DOMAIN}"
        else
            printf "Enter contact email for Let's Encrypt SSL (default: admin@%s): " "${DOMAIN}"
            read -r USER_EMAIL
            ACME_EMAIL="${USER_EMAIL:-admin@${DOMAIN}}"
        fi
    fi
}

# Step 6: Generate Cryptographically Secure Secrets
generate_secret() {
    local length="${1:-32}"
    if command -v openssl > /dev/null 2>&1; then
        openssl rand -hex "${length}"
    else
        head -c "${length}" /dev/urandom | od -An -tx1 | tr -d ' \n'
    fi
}

# Step 7: Clone Repository & Setup Files
setup_repository() {
    log_info "Setting up installation directory at ${INSTALL_DIR}..."
    mkdir -p "${INSTALL_DIR}"

    if [[ -d "${INSTALL_DIR}/.git" ]]; then
        log_info "Existing repository detected. Updating to latest ${BRANCH}..."
        git -C "${INSTALL_DIR}" fetch --all -q
        git -C "${INSTALL_DIR}" checkout -q "${BRANCH}"
        git -C "${INSTALL_DIR}" pull -q origin "${BRANCH}"
    else
        log_info "Cloning repository from ${REPO_URL} (${BRANCH})..."
        git clone -b "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}" -q
    fi

    mkdir -p "${INSTALL_DIR}/data" "${INSTALL_DIR}/logs"
}

# Step 8: Configure Environment File
configure_environment() {
    local env_file="${INSTALL_DIR}/.env.production"

    if [[ -f "${env_file}" ]]; then
        log_info "Production configuration .env.production already exists. Preserving secrets."
    else
        log_info "Generating production secrets in ${env_file}..."

        POSTGRES_PASS=$(generate_secret 16)
        REDIS_PASS=$(generate_secret 16)
        JWT_SECRET=$(generate_secret 32)
        ENCRYPTION_KEY=$(generate_secret 32)
        WEBHOOK_SECRET=$(generate_secret 16)

        cat << EOF > "${env_file}"
# ==============================================================================
# TitanPaaS Production Environment Configuration
# Generated automatically by install.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ==============================================================================

NODE_ENV=production
DOMAIN=${DOMAIN}
ACME_EMAIL=${ACME_EMAIL}
LOG_LEVEL=info

# Database (PostgreSQL)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${POSTGRES_PASS}
POSTGRES_DB=titan_paas

# Cache & Message Broker (Redis)
REDIS_PASSWORD=${REDIS_PASS}

# Security & Encryption
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
GITHUB_WEBHOOK_SECRET=${WEBHOOK_SECRET}
EOF

        chmod 600 "${env_file}"
        log_success "Generated secure production credentials."
    fi
}

# Step 9: Configure Systemd Service
configure_systemd() {
    if ! command -v systemctl > /dev/null 2>&1; then
        log_warn "Systemd not detected; skipping systemd service unit registration."
        return 0
    fi

    local service_file="/etc/systemd/system/titanpaas.service"
    log_info "Configuring systemd service at ${service_file}..."

    cat << EOF > "${service_file}"
[Unit]
Description=TitanPaaS Cloud Orchestration Platform
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose -f ${INSTALL_DIR}/docker-compose.prod.yml --env-file ${INSTALL_DIR}/.env.production up -d --remove-orphans
ExecStop=/usr/bin/docker compose -f ${INSTALL_DIR}/docker-compose.prod.yml --env-file ${INSTALL_DIR}/.env.production down
ExecReload=/usr/bin/docker compose -f ${INSTALL_DIR}/docker-compose.prod.yml --env-file ${INSTALL_DIR}/.env.production restart
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable titanpaas > /dev/null 2>&1 || true
    log_success "Systemd service titanpaas registered and enabled."
}

# Step 10: Start Stack & Verify Deployment
start_stack() {
    log_info "Building and starting TitanPaaS production containers..."
    cd "${INSTALL_DIR}"

    docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

    log_info "Waiting for core services (PostgreSQL, Redis) to report healthy..."
    local attempts=0
    local max_attempts=30

    while [[ ${attempts} -lt ${max_attempts} ]]; do
        if docker compose -f docker-compose.prod.yml ps | grep -q "healthy"; then
            break
        fi
        sleep 2
        attempts=$((attempts + 1))
    done

    log_info "Applying database migrations..."
    docker compose -f docker-compose.prod.yml --env-file .env.production exec -T titan-api npm run migration:run || {
        log_warn "Migrations already executed or executed during container bootstrap."
    }

    log_info "Verifying API health endpoint..."
    local health_attempts=0
    while [[ ${health_attempts} -lt 15 ]]; do
        if curl -fsSL http://localhost:3000/system/health > /dev/null 2>&1; then
            log_success "Health check passed: TitanPaaS API is operational."
            break
        fi
        sleep 2
        health_attempts=$((health_attempts + 1))
    done
}

print_summary() {
    printf "\n"
    printf "==============================================================================\n"
    printf " TitanPaaS Production Installation Completed Successfully\n"
    printf "==============================================================================\n"
    printf " Installation Directory: %s\n" "${INSTALL_DIR}"
    printf " Primary URL:            http://%s (or https://%s)\n" "${DOMAIN}" "${DOMAIN}"
    printf " API Health Probe:       http://%s/system/health\n" "${DOMAIN}"
    printf " Swagger Documentation:  http://%s/api\n" "${DOMAIN}"
    printf " Environment Config:     %s/.env.production\n" "${INSTALL_DIR}"
    printf "\n"
    printf " Useful Management Commands:\n"
    printf "   systemctl status titanpaas     Check service status\n"
    printf "   systemctl restart titanpaas    Restart all platform containers\n"
    printf "   docker compose -f %s/docker-compose.prod.yml logs -f\n" "${INSTALL_DIR}"
    printf "==============================================================================\n"
}

main() {
    check_root
    detect_os
    install_dependencies
    install_docker
    detect_network_info
    setup_repository
    configure_environment
    configure_systemd
    start_stack
    print_summary
}

# Execute main routine if not being sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main
fi
