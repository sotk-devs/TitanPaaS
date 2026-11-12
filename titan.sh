#!/usr/bin/env bash
# ==============================================================================
# TitanPaaS Quick Entrypoint Installer
# Allows: curl -fsSL https://.../titan.sh | bash
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${SCRIPT_DIR}/scripts/install.sh" ]]; then
    exec bash "${SCRIPT_DIR}/scripts/install.sh" "$@"
else
    # Sourced remotely via curl | bash
    TMP_DIR=$(mktemp -d)
    trap 'rm -rf "${TMP_DIR}"' EXIT
    curl -fsSL "https://raw.githubusercontent.com/sotk-devs/TitanPaaS/main/scripts/install.sh" -o "${TMP_DIR}/install.sh"
    exec bash "${TMP_DIR}/install.sh" "$@"
fi
