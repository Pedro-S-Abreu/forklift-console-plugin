#!/bin/bash
set -euo pipefail

LOG_FILE="/tmp/quick-start3.log"
exec > >(tee -a "$LOG_FILE") 2>&1
trap 'echo "❌ Script failed at line $LINENO. See $LOG_FILE for details."' ERR

echo "======================================="
echo " 🔧 OpenShift Dev Environment Setup 🔧 "
echo "======================================="
echo "[LOG] Script started at $(date)"

# Prompt user for cluster number (1–8)
# while true; do
#   read -p "Enter cluster number (1-8): " CLUSTER_INPUT
#   if [[ "$CLUSTER_INPUT" =~ ^[1-8]$ ]]; then
#     break
#   else
#     echo "❌ Invalid input. Please enter a number between 1 and 8."
#   fi
# done

# Format cluster number (e.g., 1 → 01)
#CLUSTER_ID="uit-420-migration"
CLUSTER_ID="uit-419-mtv-1117"
CLUSTER_ID="qemtv-09"
#CLUSTER_ID="uit-418-1030"
CLUSTER_ADDRESS="${CLUSTER_ID}.rhos-psi.cnv-qe.rhood.us"

# Mount NFS
NFS_MOUNT_POINT="$HOME/nfs-mount"
NFS_SERVER="10.9.96.21:/rhos_psi_cluster_dirs"

echo "[LOG] Checking if NFS is already mounted..."
if mount | grep -q "$NFS_MOUNT_POINT"; then
  echo "✅ NFS already mounted at $NFS_MOUNT_POINT"
else
  echo "🔗 Mounting NFS share..."
  echo "NFS Server: $NFS_SERVER"
  echo "Mount Point: $NFS_MOUNT_POINT"
  sudo mkdir -p "$NFS_MOUNT_POINT"
  sudo mount -t nfs "$NFS_SERVER" "$NFS_MOUNT_POINT"
  if [ $? -ne 0 ]; then
    echo "❌ Failed to mount NFS. Check your permissions or network."
    exit 1
  fi
fi

echo "[LOG] Reading kubeadmin password..."
KUBEADMIN_PASSWORD_FILE="${NFS_MOUNT_POINT}/${CLUSTER_ID}/auth/kubeadmin-password"
if [ ! -f "$KUBEADMIN_PASSWORD_FILE" ]; then
  echo "❌ Kubeadmin password not found at ${KUBEADMIN_PASSWORD_FILE}"
  exit 1
fi
KUBEADMIN_PASSWORD=$(cat "$KUBEADMIN_PASSWORD_FILE")
echo "Kubeadmin password retrieved from ${KUBEADMIN_PASSWORD_FILE}"

# Export environment variables
export BRIDGE_BRANDING="openshift"
echo "[LOG] Environment variable BRIDGE_BRANDING set to openshift"
