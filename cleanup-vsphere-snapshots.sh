#!/bin/bash

# Clean vSphere VM Snapshots for Warm Migration Tests
# Usage: ./cleanup-vsphere-snapshots.sh <vm-name> [provider-name] [namespace]

VM_NAME="${1}"
PROVIDER_NAME="${2:-vs8}"
NAMESPACE="${3:-openshift-mtv}"

if [ -z "$VM_NAME" ]; then
    echo "❌ Error: VM name is required"
    echo "Usage: $0 <vm-name> [provider-name] [namespace]"
    exit 1
fi

echo "🧹 Cleaning vSphere snapshots for VM: $VM_NAME"
echo "========================================================================="
echo ""

# Get the provider UID
echo "📡 Fetching provider information..."
PROVIDER_UID=$(oc get provider $PROVIDER_NAME -n $NAMESPACE -o jsonpath='{.metadata.uid}' 2>/dev/null)

if [ -z "$PROVIDER_UID" ]; then
    echo "❌ Provider '$PROVIDER_NAME' not found in namespace '$NAMESPACE'"
    exit 1
fi

echo "✅ Provider: $PROVIDER_NAME (UID: $PROVIDER_UID)"
echo ""

# Get the inventory route
INVENTORY_ROUTE=$(oc get route forklift-inventory -n $NAMESPACE -o jsonpath='{.spec.host}' 2>/dev/null)

if [ -z "$INVENTORY_ROUTE" ]; then
    echo "❌ Forklift inventory route not found"
    exit 1
fi

echo "📡 Inventory API: https://$INVENTORY_ROUTE"
echo ""

# Get auth token
TOKEN=$(oc whoami -t)

# Get VM details including snapshots
echo "🔍 Checking VM '$VM_NAME' for snapshots..."
VM_DATA=$(curl -sk -H "Authorization: Bearer $TOKEN" \
    "https://$INVENTORY_ROUTE/providers/vsphere/$PROVIDER_UID/vms" 2>/dev/null | \
    jq -r --arg vm_name "$VM_NAME" '.[] | select(.name == $vm_name)')

if [ -z "$VM_DATA" ]; then
    echo "❌ VM '$VM_NAME' not found in provider inventory"
    exit 1
fi

VM_ID=$(echo "$VM_DATA" | jq -r '.id')
SNAPSHOT_COUNT=$(echo "$VM_DATA" | jq -r '.snapshots // [] | length')

echo "✅ VM found: $VM_NAME (ID: $VM_ID)"
echo "📸 Snapshots detected: $SNAPSHOT_COUNT"
echo ""

if [ "$SNAPSHOT_COUNT" -eq "0" ]; then
    echo "✅ No snapshots to clean - VM is ready for warm migration!"
    exit 0
fi

# Display snapshot details
echo "📸 Snapshot details:"
echo "$VM_DATA" | jq -r '.snapshots[] | "  • \(.name // "unnamed") - \(.description // "no description")"'
echo ""

# Instructions for manual cleanup (since we can't programmatically delete via API)
echo "⚠️  vSphere snapshots detected - Manual cleanup required"
echo "========================================================================="
echo ""
echo "To remove snapshots and enable warm migration:"
echo ""
echo "🌐 Option 1: vSphere UI (Recommended)"
echo "  1. Log into vSphere vCenter"
echo "  2. Find VM: $VM_NAME"
echo "  3. Right-click → Snapshots → Manage Snapshots"
echo "  4. Delete ALL snapshots"
echo "  5. Wait for deletion to complete"
echo ""
echo "🔧 Option 2: Using govc CLI"
echo "  # If you have govc installed and configured:"
echo "  govc snapshot.remove -vm '$VM_NAME' '*'"
echo ""
echo "After removing snapshots, refresh the provider inventory:"
echo "  oc annotate provider $PROVIDER_NAME -n $NAMESPACE \\"
echo "    forklift.konveyor.io/refreshed-at=\"\$(date -u +%Y-%m-%dT%H:%M:%SZ)\" --overwrite"
echo ""
echo "========================================================================="

exit 2  # Exit code 2 indicates snapshots found (not an error, but action needed)

