#!/bin/bash

# Script to create an OpenShift user WITHOUT cluster-reader privileges
# This is useful for testing permission-based bugs

set -e

USERNAME="${1:-testuser}"
PASSWORD="${2:-testpass}"

echo "Creating user: $USERNAME with password: $PASSWORD"
echo "=============================================="

# Step 1: Create htpasswd file
echo "Step 1: Creating htpasswd file..."
htpasswd -c -B -b /tmp/htpasswd-temp "$USERNAME" "$PASSWORD"

# Step 2: Check if htpass-secret already exists
echo "Step 2: Checking for existing htpass-secret..."
if oc get secret htpass-secret -n openshift-config &>/dev/null; then
    echo "  - Secret exists, downloading and updating..."
    oc get secret htpass-secret -n openshift-config -o jsonpath='{.data.htpasswd}' | base64 -d > /tmp/htpasswd-existing
    htpasswd -B -b /tmp/htpasswd-existing "$USERNAME" "$PASSWORD"
    oc create secret generic htpass-secret --from-file=htpasswd=/tmp/htpasswd-existing -n openshift-config --dry-run=client -o yaml | oc replace -f -
    rm /tmp/htpasswd-existing
else
    echo "  - Secret doesn't exist, creating new one..."
    oc create secret generic htpass-secret --from-file=htpasswd=/tmp/htpasswd-temp -n openshift-config
fi

# Step 3: Check if HTPasswd OAuth provider exists
echo "Step 3: Checking OAuth configuration..."
if oc get oauth cluster -o jsonpath='{.spec.identityProviders[?(@.type=="HTPasswd")]}' | grep -q HTPasswd; then
    echo "  - HTPasswd provider already configured"
else
    echo "  - Adding HTPasswd identity provider..."
    # Get current OAuth config
    oc get oauth cluster -o json > /tmp/oauth-config.json
    
    # Add HTPasswd provider (this will append to existing providers)
    cat <<EOF | oc apply -f -
apiVersion: config.openshift.io/v1
kind: OAuth
metadata:
  name: cluster
spec:
  identityProviders:
  - name: htpasswd
    mappingMethod: claim
    type: HTPasswd
    htpasswd:
      fileData:
        name: htpass-secret
EOF
fi

# Cleanup temp file
rm -f /tmp/htpasswd-temp

echo ""
echo "=============================================="
echo "User '$USERNAME' created successfully!"
echo "=============================================="
echo ""
echo "The authentication operator will now restart. This may take 2-5 minutes."
echo ""
echo "After the restart, you can:"
echo "1. Login via CLI: oc login -u $USERNAME -p $PASSWORD"
echo "2. Login via UI using the same credentials"
echo ""
echo "This user will have NO cluster-reader privileges by default."
echo "You can verify this by running:"
echo "  oc get clusterrolebindings | grep $USERNAME"
echo ""
echo "To give specific namespace access (optional):"
echo "  oc adm policy add-role-to-user view $USERNAME -n <namespace>"
echo ""

