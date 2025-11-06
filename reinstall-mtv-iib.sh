#!/bin/bash
set -euo pipefail

# Simple MTV Operator Reinstall from IIB
# Usage: ./reinstall-mtv-iib.sh --iib-image <image> [--namespace <ns>]

IIB_IMAGE=""
NAMESPACE="openshift-mtv"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --iib-image)
            IIB_IMAGE="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 --iib-image <image> [--namespace <namespace>]"
            echo "Example: $0 --iib-image quay.io/example/forklift-fbc:latest"
            exit 0
            ;;
        *)
            echo "Error: Unknown option $1"
            exit 1
            ;;
    esac
done

if [ -z "$IIB_IMAGE" ]; then
    echo "Error: --iib-image is required"
    exit 1
fi

echo "=== MTV Operator Reinstall from IIB ==="
echo "IIB Image: $IIB_IMAGE"
echo "Namespace: $NAMESPACE"
echo ""

# 1. Clean uninstall
echo "1. Uninstalling existing MTV operator..."
oc delete forkliftcontroller --all -n "$NAMESPACE" --ignore-not-found=true --timeout=60s
oc delete subscription mtv-operator forklift-operator -n "$NAMESPACE" --ignore-not-found=true
oc delete csv -l operators.coreos.com/mtv-operator.$NAMESPACE -n "$NAMESPACE" --ignore-not-found=true
oc delete catalogsource konveyor-forklift -n "$NAMESPACE" --ignore-not-found=true
oc delete operatorgroup migration -n "$NAMESPACE" --ignore-not-found=true
echo "✓ Cleanup completed"

# 2. Create catalog source
echo ""
echo "2. Creating catalog source..."
oc create namespace "$NAMESPACE" --dry-run=client -o yaml | oc apply -f -

cat << EOF | oc apply -f -
apiVersion: operators.coreos.com/v1alpha1
kind: CatalogSource
metadata:
  name: konveyor-forklift
  namespace: $NAMESPACE
spec:
  displayName: Migration Toolkit for Virtualization
  image: $IIB_IMAGE
  publisher: Red Hat
  sourceType: grpc
EOF

# Wait for catalog source to be ready
echo "Waiting for catalog source to be ready..."
while true; do
    STATE=$(oc get catalogsource konveyor-forklift -n "$NAMESPACE" -o jsonpath='{.status.connectionState.lastObservedState}' 2>/dev/null || echo "")
    if [ "$STATE" = "READY" ]; then
        echo "✓ Catalog source ready"
        break
    fi
    echo "  Current state: $STATE (waiting...)"
    sleep 10
done

# Wait for packagemanifest to fully populate (critical!)
echo "Waiting for packagemanifest to populate (3+ minutes needed)..."
sleep 30

# 3. Query and select channel
echo ""
echo "3. Querying available channels..."
CHANNELS=$(oc get packagemanifest mtv-operator -o jsonpath='{.status.channels[*].name}' 2>/dev/null || echo "")
if [ -z "$CHANNELS" ]; then
    echo "Error: No channels found in packagemanifest"
    exit 1
fi

echo "Available channels:"
CHANNEL_ARRAY=($CHANNELS)
for i in "${!CHANNEL_ARRAY[@]}"; do
    echo "  $((i+1))) ${CHANNEL_ARRAY[i]}"
done

echo -n "Select channel (1-${#CHANNEL_ARRAY[@]}): "
read -r choice
if [[ ! "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "${#CHANNEL_ARRAY[@]}" ]; then
    echo "Error: Invalid selection"
    exit 1
fi
CHANNEL="${CHANNEL_ARRAY[$((choice-1))]}"
echo "✓ Selected channel: $CHANNEL"

# 4. Query and select version
echo ""
echo "4. Querying available versions for channel '$CHANNEL'..."

# Get versions from entries and currentCSV
VERSIONS=$(oc get packagemanifest mtv-operator -o jsonpath="{.status.channels[?(@.name=='$CHANNEL')].entries[*].version}" 2>/dev/null | xargs)
CURRENT_CSV=$(oc get packagemanifest mtv-operator -o jsonpath="{.status.channels[?(@.name=='$CHANNEL')].currentCSV}" 2>/dev/null)

# Extract version from currentCSV as fallback
CSV_VERSION=""
if [ -n "$CURRENT_CSV" ]; then
    CSV_VERSION=$(echo "$CURRENT_CSV" | sed 's/.*\.v\([0-9]\+\.[0-9]\+\.[0-9]\+[^[:space:]]*\).*/\1/')
fi

if [ -n "$VERSIONS" ]; then
    # Multiple versions available from entries
    echo "Available versions:"
    VERSION_ARRAY=($VERSIONS)
    for i in "${!VERSION_ARRAY[@]}"; do
        echo "  $((i+1))) ${VERSION_ARRAY[i]}"
    done
    
    echo -n "Select version (1-${#VERSION_ARRAY[@]}) or press Enter for latest: "
    read -r choice
    if [ -n "$choice" ]; then
        if [[ ! "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "${#VERSION_ARRAY[@]}" ]; then
            echo "Error: Invalid selection"
            exit 1
        fi
        VERSION="${VERSION_ARRAY[$((choice-1))]}"
        echo "✓ Selected version: $VERSION"
    else
        echo "✓ Using latest version"
        VERSION=""
    fi
elif [ -n "$CSV_VERSION" ]; then
    # Only currentCSV available (like dev-preview channel)
    echo "Available version: $CSV_VERSION (from currentCSV)"
    echo -n "Use this version? [Y/n]: "
    read -r choice
    if [ -z "$choice" ] || [[ "$choice" =~ ^[Yy] ]]; then
        VERSION="$CSV_VERSION"
        echo "✓ Selected version: $VERSION"
    else
        echo "✓ Using latest version"
        VERSION=""
    fi
else
    echo "Error: No versions found for channel '$CHANNEL'"
    echo "This suggests the packagemanifest is not fully populated yet."
    exit 1
fi

# 5. Install operator
echo ""
echo "5. Installing MTV operator..."

# Create operator group
cat << EOF | oc apply -f -
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: migration
  namespace: $NAMESPACE
spec:
  targetNamespaces:
  - $NAMESPACE
EOF

# Create subscription
SUBSCRIPTION_YAML="apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: mtv-operator
  namespace: $NAMESPACE
spec:
  channel: $CHANNEL
  installPlanApproval: Automatic
  name: mtv-operator
  source: konveyor-forklift
  sourceNamespace: $NAMESPACE"

if [ -n "$VERSION" ]; then
    SUBSCRIPTION_YAML="$SUBSCRIPTION_YAML
  startingCSV: mtv-operator.v$VERSION"
fi

echo "$SUBSCRIPTION_YAML" | oc apply -f -

# Wait for installation
echo "Waiting for operator installation..."
for i in {1..60}; do
    CSV_NAME=$(oc get subscription mtv-operator -n "$NAMESPACE" -o jsonpath='{.status.currentCSV}' 2>/dev/null || echo "")
    if [ -n "$CSV_NAME" ]; then
        CSV_PHASE=$(oc get csv "$CSV_NAME" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "")
        if [ "$CSV_PHASE" = "Succeeded" ]; then
            echo "✓ MTV operator installed successfully: $CSV_NAME"
            break
        fi
        echo "  CSV: $CSV_NAME, Phase: $CSV_PHASE (waiting...)"
    else
        echo "  Waiting for CSV to be created..."
    fi
    sleep 5
done

echo ""
echo "=== Installation Complete ==="
echo "Channel: $CHANNEL"
echo "Version: ${VERSION:-latest}"
echo "Namespace: $NAMESPACE"
echo ""
echo "You can now create a ForkliftController to complete the setup."
