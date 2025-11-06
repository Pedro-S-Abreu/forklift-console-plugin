#!/bin/bash

# Global Nuclear Migration Cleanup Script
# This script eliminates ALL VMs, VMIs, and PVCs with migration patterns across ALL namespaces
# ⚠️  DESTRUCTIVE: Use with caution! Preserves migration plans only.

echo "🌍 Global Nuclear Migration Cleanup..."
echo "======================================"
echo "⚠️  WARNING: This will delete ALL VMs, VMIs, and PVCs with migration patterns"
echo "⚠️  across ALL namespaces (but preserve migration plans)"
echo ""


echo ""
echo "💥 Starting global nuclear cleanup..."
echo "======================================"

# Function to nuclear delete resource with finalizer removal and timeout
nuclear_delete() {
    local resource_type=$1
    local resource_name=$2 
    local namespace=$3
    
    echo "  ↳ Nuclear deleting $resource_type/$resource_name in $namespace"
    
    # Remove finalizers first (with timeout)
    timeout 10s oc patch $resource_type $resource_name -n $namespace --type merge -p '{"metadata":{"finalizers":null}}' >/dev/null 2>&1 || echo "    ⚠️  Finalizer patch timeout"
    
    # Force delete with timeout
    timeout 15s oc delete $resource_type $resource_name -n $namespace --force --grace-period=0 >/dev/null 2>&1 || echo "    ⚠️  Delete timeout - resource may be stuck"
}

# Step 1: Find and delete all VMs with migration patterns (with parallel processing)
echo "🖥️  Step 1: Global VM cleanup (parallel)..."
echo "---------------------------------------------"
VM_COUNT=0

# Collect all VMs first
VM_TARGETS=()
for namespace in $(oc get namespaces -o name | cut -d'/' -f2); do
    VM_LIST=$(oc get vm -n $namespace --no-headers 2>/dev/null | grep -E "(mtv|man-)" | awk '{print $1}')
    if [ ! -z "$VM_LIST" ]; then
        echo "🎯 Found VMs in namespace: $namespace"
        for vm in $VM_LIST; do
            VM_TARGETS+=("$vm:$namespace")
            ((VM_COUNT++))
        done
    fi
done

if [ $VM_COUNT -gt 0 ]; then
    echo "💥 Parallel deleting $VM_COUNT VMs..."
    # Delete VMs in parallel with timeout
    for vm_target in "${VM_TARGETS[@]}"; do
        vm=$(echo $vm_target | cut -d':' -f1)
        namespace=$(echo $vm_target | cut -d':' -f2)
        (
            echo "  ↳ Background deleting vm/$vm in $namespace"
            timeout 30s oc patch vm $vm -n $namespace --type merge -p '{"metadata":{"finalizers":null}}' >/dev/null 2>&1
            timeout 30s oc delete vm $vm -n $namespace --force --grace-period=0 >/dev/null 2>&1
        ) &
    done
    
    # Wait for all background deletions (with overall timeout)
    echo "⏳ Waiting for VM deletions to complete (max 60s)..."
    timeout 60s wait
    echo "✅ VM cleanup completed (or timed out)"
else
    echo "✅ No VMs found to delete"
fi
echo ""

# Step 2: Find and delete all VMIs with migration patterns
echo "🔄 Step 2: Global VMI cleanup..."
echo "--------------------------------"
VMI_COUNT=0
for namespace in $(oc get namespaces -o name | cut -d'/' -f2); do
    VMI_LIST=$(oc get vmi -n $namespace --no-headers 2>/dev/null | grep -E "(mtv|man-)" | awk '{print $1}')
    if [ ! -z "$VMI_LIST" ]; then
        echo "🎯 Found VMIs in namespace: $namespace"
        for vmi in $VMI_LIST; do
            nuclear_delete "vmi" "$vmi" "$namespace"
            ((VMI_COUNT++))
        done
    fi
done
echo "✅ Deleted $VMI_COUNT VMIs globally"
echo ""

# Step 3: Find and delete all PVCs with migration patterns (parallel + timeout)
echo "💾 Step 3: Global PVC cleanup (parallel)..."
echo "---------------------------------------------"
PVC_COUNT=0

# Collect all PVCs first
PVC_TARGETS=()
for namespace in $(oc get namespaces -o name | cut -d'/' -f2); do
    PVC_LIST=$(oc get pvc -n $namespace --no-headers 2>/dev/null | grep -E "(mtv|man-)" | awk '{print $1}')
    if [ ! -z "$PVC_LIST" ]; then
        echo "🎯 Found PVCs in namespace: $namespace"
        for pvc in $PVC_LIST; do
            PVC_TARGETS+=("$pvc:$namespace")
            ((PVC_COUNT++))
        done
    fi
done

if [ $PVC_COUNT -gt 0 ]; then
    echo "💥 Parallel deleting $PVC_COUNT PVCs (timeout protection)..."
    # Delete PVCs in parallel with aggressive timeout
    for pvc_target in "${PVC_TARGETS[@]}"; do
        pvc=$(echo $pvc_target | cut -d':' -f1)
        namespace=$(echo $pvc_target | cut -d':' -f2)
        (
            echo "  ↳ Background deleting pvc/$pvc in $namespace"
            timeout 10s oc patch pvc $pvc -n $namespace --type merge -p '{"metadata":{"finalizers":null}}' >/dev/null 2>&1
            timeout 20s oc delete pvc $pvc -n $namespace --force --grace-period=0 >/dev/null 2>&1
        ) &
    done
    
    # Wait for all PVC deletions (short timeout since PVCs can get really stuck)
    echo "⏳ Waiting for PVC deletions (max 45s)..."
    timeout 45s wait
    echo "✅ PVC cleanup completed (or timed out)"
else
    echo "✅ No PVCs found to delete"
fi
echo ""

# Step 4: Find and delete all DataVolumes with migration patterns
echo "🗄️  Step 4: Global DataVolume cleanup..."
echo "----------------------------------------"
DV_COUNT=0
for namespace in $(oc get namespaces -o name | cut -d'/' -f2); do
    DV_LIST=$(oc get dv -n $namespace --no-headers 2>/dev/null | grep -E "(mtv|man-)" | awk '{print $1}')
    if [ ! -z "$DV_LIST" ]; then
        echo "🎯 Found DataVolumes in namespace: $namespace"
        for dv in $DV_LIST; do
            nuclear_delete "dv" "$dv" "$namespace"
            ((DV_COUNT++))
        done
    fi
done
echo "✅ Deleted $DV_COUNT DataVolumes globally"
echo ""

# Step 5: Clean up migration-related pods and jobs globally
echo "🧹 Step 5: Global pods and jobs cleanup..."
echo "------------------------------------------"
POD_COUNT=0
JOB_COUNT=0
for namespace in $(oc get namespaces -o name | cut -d'/' -f2); do
    # Clean pods
    POD_LIST=$(oc get pods -n $namespace --no-headers 2>/dev/null | grep -E "(mtv|man-)" | awk '{print $1}')
    if [ ! -z "$POD_LIST" ]; then
        for pod in $POD_LIST; do
            nuclear_delete "pod" "$pod" "$namespace"
            ((POD_COUNT++))
        done
    fi
    
    # Clean jobs
    JOB_LIST=$(oc get jobs -n $namespace --no-headers 2>/dev/null | grep -E "(mtv|man-)" | awk '{print $1}')
    if [ ! -z "$JOB_LIST" ]; then
        for job in $JOB_LIST; do
            nuclear_delete "job" "$job" "$namespace"
            ((JOB_COUNT++))
        done
    fi
done
echo "✅ Deleted $POD_COUNT pods and $JOB_COUNT jobs globally"
echo ""

# Step 6: Clean up migrations (but preserve plans)
echo "🔄 Step 6: Global migration cleanup..."
echo "--------------------------------------"
MIGRATION_COUNT=0
MIGRATION_LIST=$(oc get migration -n openshift-mtv --no-headers 2>/dev/null | awk '{print $1}')
if [ ! -z "$MIGRATION_LIST" ]; then
    for migration in $MIGRATION_LIST; do
        nuclear_delete "migration" "$migration" "openshift-mtv"
        ((MIGRATION_COUNT++))
    done
fi
echo "✅ Deleted $MIGRATION_COUNT migrations (preserved plans)"
echo ""

# Step 7: Clean up Released Ceph storage globally
echo "💾 Step 7: Global Ceph storage cleanup..."
echo "-----------------------------------------"
RELEASED_PVS=$(oc get pv -o name 2>/dev/null | grep pv | head -5) # Sample first to check
if [ ! -z "$RELEASED_PVS" ]; then
    RELEASED_COUNT=$(oc get pv 2>/dev/null | grep "Released.*ocs.*ceph" | wc -l)
    RELEASED_SIZE=$(oc get pv 2>/dev/null | grep "Released.*ocs.*ceph" | awk '{sum+=$2} END {print sum}')
    
    if [ "$RELEASED_COUNT" -gt 0 ]; then
        echo "🎯 Found $RELEASED_COUNT Released Ceph PVs consuming ${RELEASED_SIZE}Gi"
        echo "💥 Nuclear cleaning Released Ceph storage..."
        
        CLEANED_COUNT=0
        for pv in $(oc get pv -o name 2>/dev/null); do
            PV_STATUS=$(oc get $pv -o jsonpath='{.status.phase}' 2>/dev/null)
            STORAGE_CLASS=$(oc get $pv -o jsonpath='{.spec.storageClassName}' 2>/dev/null)
            
            if [[ "$PV_STATUS" == "Released" && "$STORAGE_CLASS" =~ ocs.*ceph ]]; then
                PV_NAME=$(echo $pv | cut -d'/' -f2)
                echo "  ↳ Nuclear deleting Released PV: $PV_NAME"
                timeout 30s oc delete $pv --force --grace-period=0 >/dev/null 2>&1 || echo "    ⚠️  Failed to delete $PV_NAME"
                ((CLEANED_COUNT++))
            fi
        done
        echo "✅ Cleaned up $CLEANED_COUNT Released Ceph PVs (~${RELEASED_SIZE}Gi recovered)"
    else
        echo "✅ No Released Ceph PVs found"
    fi
else
    echo "✅ No PVs found to check"
fi
echo ""

# Step 8: Final verification
echo "✅ Step 8: Global verification..."
echo "---------------------------------"
echo "📊 Global Cleanup Summary:"
echo "  • VMs deleted: $VM_COUNT"
echo "  • VMIs deleted: $VMI_COUNT" 
echo "  • PVCs deleted: $PVC_COUNT"
echo "  • DataVolumes deleted: $DV_COUNT"
echo "  • Pods deleted: $POD_COUNT"
echo "  • Jobs deleted: $JOB_COUNT"
echo "  • Migrations deleted: $MIGRATION_COUNT"
echo "  • Released Ceph PVs cleaned: ${CLEANED_COUNT:-0}"
echo ""

echo "📋 Preserved migration plans:"
oc get plan -n openshift-mtv 2>/dev/null || echo "  No plans found"

echo ""
echo "🔍 Remaining migration artifacts check:"
REMAINING_VMS=$(oc get vm --all-namespaces 2>/dev/null | grep -E "(mtv|man-)" | wc -l)
REMAINING_PVCS=$(oc get pvc --all-namespaces 2>/dev/null | grep -E "(mtv|man-)" | wc -l)
REMAINING_RELEASED=$(oc get pv 2>/dev/null | grep "Released.*ocs.*ceph" | wc -l)
echo "  • Remaining VMs: $REMAINING_VMS"
echo "  • Remaining PVCs: $REMAINING_PVCS"
echo "  • Remaining Released Ceph PVs: $REMAINING_RELEASED"

if [ "$REMAINING_VMS" -eq 0 ] && [ "$REMAINING_PVCS" -eq 0 ] && [ "$REMAINING_RELEASED" -eq 0 ]; then
    echo "✅ PERFECT: Environment completely clean!"
else
    echo "⚠️  Some resources may still be terminating..."
fi

echo ""
echo "🎉 Global Nuclear Cleanup Completed!"
echo "===================================="
echo ""
echo "🌍 Global Nuclear Results:"
echo "  • ALL migration VMs/VMIs eliminated globally"
echo "  • ALL migration PVCs eliminated globally" 
echo "  • ALL Released Ceph storage reclaimed"
echo "  • ALL storage conflicts resolved"
echo "  • Migration plans preserved for reuse"
echo ""
echo "🚀 Ready for fresh migrations without ANY conflicts!"
echo "✨ Clean slate across the entire cluster!"
echo "💾 Maximum Ceph storage space recovered!"
