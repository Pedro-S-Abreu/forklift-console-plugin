#!/bin/bash
# Cleanup script to remove OVA files from NFS share after automated tests
# Works on both macOS and Linux (including Docker containers)

set -e

# Can be overridden by environment variables
NFS_SERVER="${NFS_SERVER:-f02-h06-000-r640.rdu2.scalelab.redhat.com}"
NFS_PATH="${NFS_PATH:-/home/nfsshare-test/ova}"
MOUNT_POINT="$HOME/nfsshare-test/ova"
OVA_FILE="${OVA_FILE:-2nd_disk_v3.ova}"

# Detect if we need sudo (not needed in Docker containers running as root)
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
fi

echo "🧹 Cleaning up $OVA_FILE from NFS share..."

# Create mount point
mkdir -p "$MOUNT_POINT"

# Mount NFS share (with OS-specific options)
echo "📁 Mounting NFS share..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    $SUDO mount -t nfs -o resvport "$NFS_SERVER:$NFS_PATH" "$MOUNT_POINT"
else
    # Linux
    $SUDO mount -t nfs "$NFS_SERVER:$NFS_PATH" "$MOUNT_POINT"
fi

# Find and delete the OVA file and its appliance directory
echo "🔍 Searching for $OVA_FILE..."
OVA_PATH=$($SUDO find "$MOUNT_POINT" -name "$OVA_FILE" 2>/dev/null | head -n 1)

if [ -n "$OVA_PATH" ]; then
    APPLIANCE_DIR=$(dirname "$OVA_PATH")
    echo "🗑️  Deleting: $OVA_PATH"
    $SUDO rm "$OVA_PATH"
    echo "🗑️  Removing appliance directory: $(basename "$APPLIANCE_DIR")"
    $SUDO rmdir "$APPLIANCE_DIR"
    echo "✅ Successfully deleted $OVA_FILE and its appliance directory"
else
    echo "⚠️  $OVA_FILE not found (already deleted or not uploaded)"
fi

# Unmount and cleanup
echo "📤 Unmounting NFS share..."

# Unmount with OS-specific commands
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - try diskutil first, then fallback to umount
    if command -v diskutil &> /dev/null; then
        diskutil unmount force "$MOUNT_POINT" 2>/dev/null || $SUDO umount -f "$MOUNT_POINT" 2>/dev/null || true
    else
        $SUDO umount -f "$MOUNT_POINT" 2>/dev/null || true
    fi
else
    # Linux - use standard umount
    $SUDO umount "$MOUNT_POINT" 2>/dev/null || $SUDO umount -f "$MOUNT_POINT" 2>/dev/null || true
fi

# Wait a moment for unmount to complete
sleep 1

# Remove mount point (ignore if busy) 
if rmdir "$MOUNT_POINT" 2>/dev/null; then
    echo "✅ Cleanup complete!"
else
    echo "✅ Cleanup complete! (mount point will be reused next time)"
fi

