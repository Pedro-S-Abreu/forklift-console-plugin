#!/bin/bash
set -e

# ==============================================================================
# Script for running Playwright e2e tests with dynamic cluster configuration
#
# This script:
# - Takes a cluster name as parameter (or uses CLUSTER_NAME from e2e.env)
# - Mounts NFS to fetch the kubeadmin password
# - Runs the Playwright tests locally (bare metal)
#
# Usage:
#   ./run-e2e-with-cluster.sh [cluster_name] [test_args]
#
# Examples:
#   ./run-e2e-with-cluster.sh                    # Uses CLUSTER_NAME from e2e.env
#   ./run-e2e-with-cluster.sh qemtv-09           # Override cluster name
#   ./run-e2e-with-cluster.sh qemtv-09 "--grep @downstream"
#
# ==============================================================================

log() {
    echo "--- $1 ---"
}

# Source e2e.env if it exists to get VSPHERE_PROVIDER and other defaults
SCRIPT_DIR="$(dirname "$0")"
if [ -f "${SCRIPT_DIR}/e2e.env" ]; then
    source "${SCRIPT_DIR}/e2e.env"
fi

# Parse arguments - cluster name can come from parameter or e2e.env
if [ -n "$1" ] && [[ ! "$1" =~ ^-- ]]; then
    # First arg is cluster name
    CLUSTER_NAME="$1"
    TEST_ARGS="${2:---grep @downstream}"
else
    # No cluster name provided, use from e2e.env
    CLUSTER_NAME="${CLUSTER_NAME}"
    TEST_ARGS="${1:---grep @downstream}"
fi

# Validate cluster name
if [ -z "$CLUSTER_NAME" ]; then
    echo "ERROR: Cluster name is required (provide as parameter or set CLUSTER_NAME in e2e.env)."
    echo "Usage: $0 [cluster_name] [test_args]"
    exit 1
fi

VSPHERE_PROVIDER="${VSPHERE_PROVIDER:-vsphere-8.0.1}"

log "E2E Test Configuration"
echo "  Cluster Name: ${CLUSTER_NAME}"
echo "  vSphere Provider: ${VSPHERE_PROVIDER}"
echo "  Test Args: ${TEST_ARGS}"
echo ""

# NFS Configuration
NFS_MOUNT_POINT="$HOME/nfs-mount"
NFS_SERVER="10.9.96.21:/rhos_psi_cluster_dirs"

log "Checking NFS mount status..."
# Check if NFS is already mounted
if timeout 5 mount | grep -q "$NFS_MOUNT_POINT"; then
    log "NFS already mounted at $NFS_MOUNT_POINT"
else
    log "Mounting NFS share..."
    echo "  NFS Server: $NFS_SERVER"
    echo "  Mount Point: $NFS_MOUNT_POINT"
    sudo mkdir -p "$NFS_MOUNT_POINT"
    sudo mount -t nfs "$NFS_SERVER" "$NFS_MOUNT_POINT"
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to mount NFS. Check your permissions or network."
        exit 1
    fi
    echo "✅ NFS mounted successfully"
fi

# Read kubeadmin password
KUBEADMIN_PASSWORD_FILE="${NFS_MOUNT_POINT}/${CLUSTER_NAME}/auth/kubeadmin-password"

log "Checking password file: ${KUBEADMIN_PASSWORD_FILE}"

if [ ! -f "$KUBEADMIN_PASSWORD_FILE" ]; then
    echo "❌ Kubeadmin password not found at ${KUBEADMIN_PASSWORD_FILE}"
    echo "   Make sure the cluster name is correct and the password file exists."
    exit 1
fi

log "Reading password file..."
CLUSTER_PASSWORD=$(cat "$KUBEADMIN_PASSWORD_FILE")
log "Password fetched successfully from NFS"

# Set up cluster address
CLUSTER_ADDRESS="${CLUSTER_NAME}.rhos-psi.cnv-qe.rhood.us"
BASE_ADDRESS="https://console-openshift-console.apps.${CLUSTER_ADDRESS}"

echo "  Base Address: ${BASE_ADDRESS}"
echo ""

# Check if .providers.json exists
PROVIDERS_JSON_FILE="$(dirname "$0")/.providers.json"
if [ ! -f "$PROVIDERS_JSON_FILE" ]; then
    echo "⚠️  WARNING: .providers.json not found at ${PROVIDERS_JSON_FILE}"
    echo "   The tests may fail if PROVIDERS_JSON is required."
    PROVIDERS_JSON="{}"
else
    PROVIDERS_JSON=$(cat "$PROVIDERS_JSON_FILE")
    log "Loaded .providers.json"
fi

# Change to testing directory
TESTING_DIR="$(cd $(dirname "$0") && pwd)"
cd "${TESTING_DIR}"

# Export environment variables for Playwright
export JENKINS=true
export CI=true
export CLUSTER_NAME="${CLUSTER_NAME}"
export CLUSTER_USERNAME="kubeadmin"
export CLUSTER_PASSWORD="${CLUSTER_PASSWORD}"
export BASE_ADDRESS="${BASE_ADDRESS}"
export VSPHERE_PROVIDER="${VSPHERE_PROVIDER}"
export NODE_TLS_REJECT_UNAUTHORIZED=0
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export LANGUAGE=en_US.UTF-8

log "Running Playwright tests locally..."
echo "  Working Directory: ${TESTING_DIR}"
echo ""

# Check if node_modules exists, install if needed
if [ ! -d "node_modules" ]; then
    log "Installing dependencies..."
    npm install
fi

# Run Playwright tests
set +e
npx playwright test ${TEST_ARGS}
TEST_EXIT_CODE=$?
set -e

if [ $TEST_EXIT_CODE -eq 0 ]; then
    log "✅ Tests completed successfully"
else
    log "❌ Tests failed with exit code: $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE

