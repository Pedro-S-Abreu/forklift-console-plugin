#!/bin/bash

# Reset Forklift Migration Plan to Ready State
# Usage: ./reset-plan.sh <plan-name> [namespace]

PLAN_NAME="${1:-vs7plan}"
NAMESPACE="${2:-openshift-mtv}"

echo "🔄 Resetting plan '$PLAN_NAME' in namespace '$NAMESPACE' to ready state..."
echo "========================================================================="
echo ""

# Function to force delete resource
force_delete() {
    local resource_type=$1
    local resource_name=$2 
    local namespace=$3
    
    echo "  ↳ Deleting $resource_type/$resource_name"
    
    # Remove finalizers first
    oc patch $resource_type $resource_name -n $namespace --type merge -p '{"metadata":{"finalizers":null}}' 2>/dev/null || true
    
    # Force delete
    oc delete $resource_type $resource_name -n $namespace --force --grace-period=0 2>/dev/null || true
}

# Step 1: Delete the migration CR
echo "🗑️  Step 1: Deleting migration CR..."
MIGRATION_EXISTS=$(oc get migration $PLAN_NAME -n $NAMESPACE --no-headers 2>/dev/null | wc -l)
if [ $MIGRATION_EXISTS -gt 0 ]; then
    force_delete "migration" "$PLAN_NAME" "$NAMESPACE"
    echo "✅ Migration deleted"
else
    echo "✅ No migration found (already clean)"
fi
echo ""

# Step 2: Find and delete VMs created by this plan
echo "🖥️  Step 2: Deleting VMs associated with plan..."
# VMs created by forklift migrations have labels or patterns we can match
VM_COUNT=0

# Try to find VMs with the plan label
VM_LIST=$(oc get vm -n $NAMESPACE -l "forklift.konveyor.io/plan=$PLAN_NAME" --no-headers 2>/dev/null | awk '{print $1}')

if [ -z "$VM_LIST" ]; then
    # Fallback: try to find VMs with mtv or plan name in the name
    VM_LIST=$(oc get vm -n $NAMESPACE --no-headers 2>/dev/null | grep -E "(mtv|$PLAN_NAME)" | awk '{print $1}')
fi

if [ ! -z "$VM_LIST" ]; then
    for vm in $VM_LIST; do
        force_delete "vm" "$vm" "$NAMESPACE"
        ((VM_COUNT++))
    done
    echo "✅ Deleted $VM_COUNT VMs"
else
    echo "✅ No VMs found to delete"
fi
echo ""

# Step 3: Clean up associated PVCs
echo "💾 Step 3: Deleting PVCs associated with plan..."
PVC_COUNT=0
PVC_LIST=$(oc get pvc -n $NAMESPACE -l "forklift.konveyor.io/plan=$PLAN_NAME" --no-headers 2>/dev/null | awk '{print $1}')

if [ -z "$PVC_LIST" ]; then
    # Fallback: find PVCs with mtv pattern
    PVC_LIST=$(oc get pvc -n $NAMESPACE --no-headers 2>/dev/null | grep -E "(mtv-|$PLAN_NAME)" | awk '{print $1}')
fi

if [ ! -z "$PVC_LIST" ]; then
    for pvc in $PVC_LIST; do
        force_delete "pvc" "$pvc" "$NAMESPACE"
        ((PVC_COUNT++))
    done
    echo "✅ Deleted $PVC_COUNT PVCs"
else
    echo "✅ No PVCs found to delete"
fi
echo ""

# Step 4: Clean up DataVolumes
echo "🗄️  Step 4: Deleting DataVolumes..."
DV_COUNT=0
DV_LIST=$(oc get dv -n $NAMESPACE --no-headers 2>/dev/null | grep -E "(mtv-|$PLAN_NAME)" | awk '{print $1}')

if [ ! -z "$DV_LIST" ]; then
    for dv in $DV_LIST; do
        force_delete "dv" "$dv" "$NAMESPACE"
        ((DV_COUNT++))
    done
    echo "✅ Deleted $DV_COUNT DataVolumes"
else
    echo "✅ No DataVolumes found to delete"
fi
echo ""

# Step 5: Reset the plan status to clear succeeded/failed state
echo "🔄 Step 5: Resetting plan status..."
PLAN_EXISTS=$(oc get plan $PLAN_NAME -n $NAMESPACE --no-headers 2>/dev/null | wc -l)
if [ $PLAN_EXISTS -gt 0 ]; then
    # Clear the migration reference and reset status conditions
    echo "  ↳ Clearing migration reference..."
    oc patch plan $PLAN_NAME -n $NAMESPACE --type merge -p '{"spec":{"migration":null}}' 2>/dev/null || true
    
    echo "  ↳ Resetting status conditions..."
    # Clear the status to reset succeeded/failed conditions
    oc patch plan $PLAN_NAME -n $NAMESPACE --type merge --subresource=status -p '{"status":{"migration":null,"conditions":[]}}' 2>/dev/null || true
    
    sleep 2  # Give the controller time to reconcile
    
    echo "✅ Plan status reset"
else
    echo "⚠️  Plan not found!"
fi
echo ""

# Step 6: Check for vSphere snapshots
echo "📸 Step 6: Checking for vSphere snapshots..."
SNAPSHOT_WARNING=0

# Get the source provider name from the plan
SOURCE_PROVIDER=$(oc get plan $PLAN_NAME -n $NAMESPACE -o jsonpath='{.spec.provider.source.name}' 2>/dev/null)

if [ ! -z "$SOURCE_PROVIDER" ]; then
    PROVIDER_TYPE=$(oc get provider $SOURCE_PROVIDER -n $NAMESPACE -o jsonpath='{.spec.type}' 2>/dev/null)
    
    if [ "$PROVIDER_TYPE" == "vsphere" ]; then
        echo "  ↳ Source provider: $SOURCE_PROVIDER (vSphere)"
        
        # Get VM list from plan
        VM_IDS=$(oc get plan $PLAN_NAME -n $NAMESPACE -o jsonpath='{.spec.vms[*].id}' 2>/dev/null)
        
        if [ ! -z "$VM_IDS" ]; then
            PROVIDER_UID=$(oc get provider $SOURCE_PROVIDER -n $NAMESPACE -o jsonpath='{.metadata.uid}')
            INVENTORY_ROUTE=$(oc get route forklift-inventory -n $NAMESPACE -o jsonpath='{.spec.host}' 2>/dev/null)
            TOKEN=$(oc whoami -t)
            
            if [ ! -z "$INVENTORY_ROUTE" ]; then
                for vm_id in $VM_IDS; do
                    VM_DATA=$(curl -sk -H "Authorization: Bearer $TOKEN" \
                        "https://$INVENTORY_ROUTE/providers/vsphere/$PROVIDER_UID/vms" 2>/dev/null | \
                        jq -r --arg vm_id "$vm_id" '.[] | select(.id == $vm_id)')
                    
                    VM_NAME=$(echo "$VM_DATA" | jq -r '.name')
                    SNAPSHOT_COUNT=$(echo "$VM_DATA" | jq -r '.snapshots // [] | length')
                    
                    if [ "$SNAPSHOT_COUNT" -gt "0" ]; then
                        echo "  ⚠️  VM '$VM_NAME' has $SNAPSHOT_COUNT snapshot(s)"
                        SNAPSHOT_WARNING=1
                    else
                        echo "  ✅ VM '$VM_NAME' has no snapshots"
                    fi
                done
            fi
        fi
    else
        echo "  ✅ Not a vSphere provider (snapshots N/A)"
    fi
else
    echo "  ⚠️  Could not determine source provider"
fi
echo ""

# Step 7: Verify plan is now in ready state
echo "🔍 Step 7: Verifying plan state..."
if [ $PLAN_EXISTS -gt 0 ]; then
    echo "Plan details:"
    oc get plan $PLAN_NAME -n $NAMESPACE
    echo ""
    echo "Status conditions:"
    oc get plan $PLAN_NAME -n $NAMESPACE -o jsonpath='{.status.conditions[*].type}' 2>/dev/null
    echo ""
fi
echo ""

# Summary
echo "✅ Reset Complete!"
echo "=================="
echo "📊 Summary:"
echo "  • Plan: $PLAN_NAME"
echo "  • Namespace: $NAMESPACE"
echo "  • Migration deleted: $([ $MIGRATION_EXISTS -gt 0 ] && echo 'Yes' || echo 'No')"
echo "  • VMs deleted: $VM_COUNT"
echo "  • PVCs deleted: $PVC_COUNT"
echo "  • DataVolumes deleted: $DV_COUNT"
echo ""

if [ $SNAPSHOT_WARNING -eq 1 ]; then
    echo "⚠️  WARNING: vSphere snapshots detected!"
    echo "   Snapshots must be removed for warm migration to work."
    echo "   Run: ./cleanup-vsphere-snapshots.sh <vm-name> $SOURCE_PROVIDER $NAMESPACE"
    echo ""
fi

echo "🚀 Plan is now ready for a new migration!"

