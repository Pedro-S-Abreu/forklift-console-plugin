#!/bin/bash

# Delete test resources from E2E test runs
# Only targets resources with "test-" prefix to avoid affecting other workloads

echo "Cleaning up test-related completed/failed pods..."
# Delete pods in test namespaces
for ns in $(oc get namespaces -o name | grep "namespace/test-" | cut -d'/' -f2); do
  oc delete pods -n "$ns" --field-selector=status.phase=Succeeded --force --grace-period=0 2>/dev/null || true
  oc delete pods -n "$ns" --field-selector=status.phase=Failed --force --grace-period=0 2>/dev/null || true
done

# Delete test VDDK validator pods from all namespaces (they use test- prefix)
oc get pods --all-namespaces -o name | grep "vddk-validator-test-" | xargs -r oc delete --force --grace-period=0 2>/dev/null || true

echo "Deleting test plans..."
oc get plans -n openshift-mtv -o name | grep "test-" | xargs -r oc delete -n openshift-mtv

echo "Deleting test providers..."
oc get providers -n openshift-mtv -o name | grep "test-" | xargs -r oc delete -n openshift-mtv

echo "Deleting test network maps..."
oc get networkmaps -n openshift-mtv -o name | grep "test-" | xargs -r oc delete -n openshift-mtv

echo "Deleting test storage maps..."
oc get storagemaps -n openshift-mtv -o name | grep "test-" | xargs -r oc delete -n openshift-mtv

echo "Deleting test namespaces/projects..."
oc get namespaces -o name | grep "namespace/test-" | xargs -r oc delete

echo "Done!"
