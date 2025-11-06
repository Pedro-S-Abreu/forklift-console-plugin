#!/bin/bash

# Migration Toolkit for Virtualization (MTV) Operator Reinstall Script
# This script uninstalls the existing MTV/Forklift operator and reinstalls it using a specified IIB image
# 
# Usage: ./reinstall-mtv-operator.sh [OPTIONS]
#
# Options:
#   --iib-image <image>      IIB image link for the catalog source (required)
#   --channel <channel>      Update channel (default: development)
#   --version <version>      Specific version to install (optional)
#   --namespace <namespace>  Target namespace (default: konveyor-forklift)
#   --timeout <timeout>      Timeout for operations (default: 360s)
#   --dry-run               Show what would be done without executing
#   --help                  Show this help message

set -euo pipefail

# Default values
DEFAULT_NAMESPACE="konveyor-forklift"
DEFAULT_MIGRATION_NAMESPACE="konveyor-migration"
DEFAULT_CHANNEL="development"
DEFAULT_TIMEOUT="360s"
DRY_RUN=false
INTERACTIVE=true
QUERY_AFTER_CATALOG=false

# Variables
FORKLIFT_NAMESPACE="${DEFAULT_NAMESPACE}"
MIGRATION_NAMESPACE="${DEFAULT_MIGRATION_NAMESPACE}"
CHANNEL="${DEFAULT_CHANNEL}"
TIMEOUT="${DEFAULT_TIMEOUT}"
IIB_IMAGE=""
VERSION=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Function to show help
show_help() {
    cat << EOF
Migration Toolkit for Virtualization (MTV) Operator Reinstall Script

This script uninstalls the existing MTV/Forklift operator and reinstalls it using a specified IIB image.

Usage: $0 [OPTIONS]

Options:
  --iib-image <image>      IIB image link for the catalog source (required)
  --channel <channel>      Update channel (default: interactive selection or ${DEFAULT_CHANNEL})
  --version <version>      Specific version to install (default: interactive selection or latest)
  --namespace <namespace>  Target namespace (default: ${DEFAULT_NAMESPACE})
  --timeout <timeout>      Timeout for operations (default: ${DEFAULT_TIMEOUT})
  --interactive           Enable interactive mode for channel and version selection (default: true)
  --non-interactive       Disable interactive mode, use provided or default values
  --dry-run               Show what would be done without executing
  --help                  Show this help message

Examples:
  # Interactive reinstall with IIB image (will prompt for channel/version)
  $0 --iib-image registry.redhat.io/redhat/redhat-operator-index:v4.14

  # Non-interactive reinstall with specific channel and version
  $0 --iib-image registry.redhat.io/redhat/redhat-operator-index:v4.14 \\
     --channel stable-v2.6 --version 2.6.0 --non-interactive

  # Dry run to see what would be done
  $0 --iib-image registry.redhat.io/redhat/redhat-operator-index:v4.14 --dry-run

EOF
}

# Function to execute or show command based on dry-run mode
execute_cmd() {
    local cmd="$1"
    if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] Would execute: $cmd"
    else
        eval "$cmd"
    fi
}

# Function to wait for resource deletion
wait_for_deletion() {
    local resource_type="$1"
    local resource_name="$2"
    local namespace="$3"
    local max_wait=120

    print_status "Waiting for $resource_type/$resource_name to be deleted (max ${max_wait}s)..."
    
    if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] Would wait for $resource_type/$resource_name deletion"
        return 0
    fi

    local count=0
    while kubectl get "$resource_type" "$resource_name" -n "$namespace" >/dev/null 2>&1; do
        if [ $count -ge $max_wait ]; then
            print_warning "Timeout waiting for $resource_type/$resource_name deletion"
            return 1
        fi
        sleep 5
        ((count+=5))
    done
    print_success "$resource_type/$resource_name deleted successfully"
}

# Function to wait for resource availability
wait_for_resource() {
    local resource_type="$1"
    local resource_name="$2"
    local namespace="$3"
    local condition="${4:-}"
    
    if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] Would wait for $resource_type/$resource_name to be available"
        return 0
    fi

    print_status "Waiting for $resource_type/$resource_name to be available..."
    
    # Wait for resource to exist
    while ! kubectl get "$resource_type" "$resource_name" -n "$namespace" >/dev/null 2>&1; do 
        sleep 10
    done
    
    # Wait for condition if specified
    if [ -n "$condition" ]; then
        kubectl wait "$resource_type" "$resource_name" -n "$namespace" --for="$condition" --timeout="$TIMEOUT"
    fi
    
    print_success "$resource_type/$resource_name is available"
}

# Function to query available channels from packagemanifest
query_available_channels() {
    local package_name="$1"
    local temp_namespace="$2"
    
    if [ "$DRY_RUN" = true ]; then
        echo "development dev-preview stable-v2.6 stable-v2.7"
        return 0
    fi

    print_status "Querying available channels for $package_name..."
    
    # Wait for packagemanifest to be available
    local count=0
    local max_wait=120
    
    while [ $count -lt $max_wait ]; do
        if kubectl get packagemanifest "$package_name" >/dev/null 2>&1; then
            break
        fi
        sleep 5
        ((count+=5))
        if [ $((count % 30)) -eq 0 ]; then
            print_status "Still waiting for packagemanifest $package_name... (${count}s/${max_wait}s)"
        fi
    done
    
    if [ $count -ge $max_wait ]; then
        print_warning "Timeout waiting for packagemanifest $package_name"
        return 1
    fi
    
    # Extract channels with better error handling
    local channels
    channels=$(kubectl get packagemanifest "$package_name" -o jsonpath='{.status.channels[*].name}' 2>/dev/null)
    
    if [ -n "$channels" ]; then
        echo "$channels"
    else
        print_warning "No channels found in packagemanifest"
        return 1
    fi
}

# Function to query available versions for a channel
query_available_versions() {
    local package_name="$1"
    local channel_name="$2"
    local temp_namespace="$3"
    
    if [ "$DRY_RUN" = true ]; then
        echo "2.10.0 2.9.0 2.8.0"
        return 0
    fi

    print_status "Querying available versions for $package_name in channel $channel_name..."
    
    # Get the current CSV for the channel
    local current_csv
    current_csv=$(kubectl get packagemanifest "$package_name" -o jsonpath="{.status.channels[?(@.name=='$channel_name')].currentCSV}" 2>/dev/null)
    
    if [ -n "$current_csv" ]; then
        # Extract version from CSV name (usually format: operator-name.vX.Y.Z)
        local version
        version=$(echo "$current_csv" | sed 's/.*\.v\([0-9]\+\.[0-9]\+\.[0-9]\+.*\)/\1/' 2>/dev/null)
        
        if [ -n "$version" ] && [ "$version" != "$current_csv" ]; then
            echo "$version"
        else
            # Fallback: just return the CSV name without operator prefix
            echo "$current_csv" | sed 's/.*\.\(v.*\)/\1/' 2>/dev/null || echo "latest"
        fi
    else
        print_warning "No current CSV found for channel $channel_name"
        echo "latest"
    fi
}

# Function to query IIB image using podman/docker (much faster than catalog source)
query_iib_image_direct() {
    local iib_image="$1"
    
    if [ "$DRY_RUN" = true ]; then
        print_status "Would query IIB image directly for metadata"
        echo "CHANNELS:development dev-preview stable-v2.6 stable-v2.7 stable-v2.8 stable-v2.9 stable-v2.10"
        echo "VERSIONS_dev-preview:2.10.0"
        echo "VERSIONS_development:2.11.0-dev"
        return 0
    fi

    print_status "Querying IIB image directly (much faster than catalog source)..."
    
    # Check if podman or docker is available
    local container_cmd=""
    if command -v podman >/dev/null 2>&1; then
        container_cmd="podman"
    elif command -v docker >/dev/null 2>&1; then
        container_cmd="docker"
    else
        print_warning "Neither podman nor docker found, falling back to manual selection"
        return 1
    fi
    
    print_status "Using $container_cmd to inspect IIB image..."
    
    # Pull and inspect the IIB image to extract operator metadata
    local temp_container="temp-iib-query-$$"
    
    # Try to run the container and extract the operator metadata
    local config_files
    config_files=$($container_cmd run --rm --entrypoint="" "$iib_image" find /configs -name "*.yaml" -exec grep -l "mtv-operator\|forklift" {} \; 2>/dev/null | head -5)
    
    if [ -n "$config_files" ]; then
        print_status "Found MTV operator configs in IIB image"
        
        # Extract channels from the config files (avoid subshell issue)
        local all_channels=""
        while IFS= read -r config_file; do
            if [ -n "$config_file" ]; then
                print_status "Extracting channels from: $config_file"
                local channels
                channels=$($container_cmd run --rm --entrypoint="" "$iib_image" cat "$config_file" 2>/dev/null | grep -A 10 -B 10 "channels:" | grep "name:" | awk '{print $2}' | tr -d '"' | sort -u | tr '\n' ' ')
                
                if [ -n "$channels" ]; then
                    all_channels="$all_channels $channels"
                fi
            fi
        done <<< "$config_files"
        
        if [ -n "$all_channels" ]; then
            # Remove duplicates and clean up
            all_channels=$(echo "$all_channels" | tr ' ' '\n' | sort -u | tr '\n' ' ' | xargs)
            echo "CHANNELS:$all_channels"
            
            # For direct IIB queries, we can't easily get all versions, so default to latest
            # The packagemanifest query after catalog creation will provide actual versions
            for channel in $all_channels; do
                echo "VERSIONS_${channel}:latest"
            done
            return 0
        else
            print_warning "No channels found in config files, trying existing catalog sources..."
            query_existing_catalog_sources
            return $?
        fi
    else
        print_warning "Direct IIB inspection failed, using existing catalog sources..."
        query_existing_catalog_sources
        return $?
    fi
}

# Function to query existing catalog sources (fallback method)
query_existing_catalog_sources() {
    print_status "Querying existing catalog sources for MTV operator information..."
    
    # Look for MTV operator in existing catalog sources
    local package_name="mtv-operator"
    local found_channels=""
    
    # Check common catalog sources
    for catalog_ns in "openshift-marketplace" "olm"; do
        if kubectl get namespace "$catalog_ns" >/dev/null 2>&1; then
            print_status "Checking catalog sources in namespace: $catalog_ns"
            
            # Look for packagemanifest
            if kubectl get packagemanifest "$package_name" -n "$catalog_ns" >/dev/null 2>&1; then
                local channels
                channels=$(kubectl get packagemanifest "$package_name" -n "$catalog_ns" -o jsonpath='{.status.channels[*].name}' 2>/dev/null)
                
                if [ -n "$channels" ]; then
                    echo "CHANNELS:$channels"
                    
                    # Get versions for each channel
                    for channel in $channels; do
                        local csv
                        csv=$(kubectl get packagemanifest "$package_name" -n "$catalog_ns" -o jsonpath="{.status.channels[?(@.name=='$channel')].currentCSV}" 2>/dev/null)
                        
                        if [ -n "$csv" ]; then
                            local version
                            version=$(echo "$csv" | sed 's/.*\.v\([0-9]\+\.[0-9]\+\.[0-9]\+.*\)/\1/' 2>/dev/null)
                            
                            if [ -n "$version" ] && [ "$version" != "$csv" ]; then
                                echo "VERSIONS_${channel}:$version"
                            fi
                        fi
                    done
                    return 0
                fi
            fi
        fi
    done
    
    print_warning "Could not find MTV operator in existing catalog sources"
    return 1
}

# Main function to query channels and versions
create_interactive_catalog_and_query() {
    # Create a temporary catalog source during interactive phase to get actual versions
    print_status "Creating temporary catalog source for version query..."
    
    local temp_namespace="temp-interactive-query-$$"
    local package_name="mtv-operator"
    
    # Create temporary namespace
    kubectl create namespace "$temp_namespace" >/dev/null 2>&1 || true
    
    # Create temporary catalog source
    local catalog_yaml
    catalog_yaml=$(cat << EOF
apiVersion: operators.coreos.com/v1alpha1
kind: CatalogSource
metadata:
  name: temp-forklift-query
  namespace: $temp_namespace
spec:
  displayName: Temporary MTV Query
  image: $IIB_IMAGE
  publisher: Temporary
  sourceType: grpc
  updateStrategy:
    registryPoll:
      interval: 10m
EOF
)
    
    echo "$catalog_yaml" | kubectl apply -f - >/dev/null 2>&1
    
    # Wait for catalog source to be ready
    local max_wait=60
    local count=0
    
    while [ $count -lt $max_wait ]; do
        if kubectl get catalogsource temp-forklift-query -n "$temp_namespace" >/dev/null 2>&1; then
            if kubectl get packagemanifest "$package_name" >/dev/null 2>&1; then
                break
            fi
        fi
        sleep 2
        ((count+=2))
    done
    
    if [ $count -ge $max_wait ]; then
        # Cleanup and return empty
        kubectl delete namespace "$temp_namespace" --force --grace-period=0 >/dev/null 2>&1 || true
        return 1
    fi
    
    # Query the packagemanifest for actual versions
    local channels
    channels=$(kubectl get packagemanifest "$package_name" -o jsonpath='{.status.channels[*].name}' 2>/dev/null)
    
    if [ -n "$channels" ]; then
        echo "CHANNELS:$channels"
        
        # Get versions for each channel
        for channel in $channels; do
            # Try to get all version entries for this channel
            local all_versions
            all_versions=$(kubectl get packagemanifest "$package_name" -o jsonpath="{.status.channels[?(@.name=='$channel')].entries[*].version}" 2>/dev/null)
            
            if [ -n "$all_versions" ]; then
                # Clean up and sort versions
                local versions
                versions=$(echo "$all_versions" | tr ' ' '\n' | sort -V -u | tr '\n' ' ' | xargs)
                echo "VERSIONS_${channel}:$versions"
            else
                # Fallback to currentCSV
                local csv
                csv=$(kubectl get packagemanifest "$package_name" -o jsonpath="{.status.channels[?(@.name=='$channel')].currentCSV}" 2>/dev/null)
                
                if [ -n "$csv" ]; then
                    local version
                    version=$(echo "$csv" | sed 's/.*\.v\([0-9]\+\.[0-9]\+\.[0-9]\+.*\)/\1/' 2>/dev/null)
                    
                    if [ -n "$version" ] && [ "$version" != "$csv" ]; then
                        echo "VERSIONS_${channel}:$version"
                    else
                        echo "VERSIONS_${channel}:latest"
                    fi
                else
                    echo "VERSIONS_${channel}:latest"
                fi
            fi
        done
    fi
    
    # Cleanup temporary resources
    kubectl delete namespace "$temp_namespace" --force --grace-period=0 >/dev/null 2>&1 || true
    
    return 0
}

create_temp_catalog_and_query() {
    # First create the catalog source and wait for it to be ready
    print_status "Creating temporary catalog source to query actual available channels..."
    
    # The catalog source should already be created by this point, so query the packagemanifest
    local package_name="mtv-operator"
    local max_wait=120
    local count=0
    
    # Wait for packagemanifest to be available
    while [ $count -lt $max_wait ]; do
        if kubectl get packagemanifest "$package_name" >/dev/null 2>&1; then
            break
        fi
        sleep 5
        ((count+=5))
        if [ $((count % 30)) -eq 0 ]; then
            print_status "Still waiting for packagemanifest $package_name... (${count}s/${max_wait}s)"
        fi
    done
    
    if [ $count -ge $max_wait ]; then
        print_warning "Timeout waiting for packagemanifest, using fallback channels"
        echo "CHANNELS:release-v2.7 release-v2.8"
        echo "VERSIONS_release-v2.7:2.7.2"
        echo "VERSIONS_release-v2.8:2.8.5"
        return 0
    fi
    
    # Get actual channels from packagemanifest
    local channels
    channels=$(kubectl get packagemanifest "$package_name" -o jsonpath='{.status.channels[*].name}' 2>/dev/null)
    
    if [ -n "$channels" ]; then
        echo "CHANNELS:$channels"
        
        # Get versions for each channel
        for channel in $channels; do
            # Try to get all version entries for this channel
            local all_versions
            all_versions=$(kubectl get packagemanifest "$package_name" -o jsonpath="{.status.channels[?(@.name=='$channel')].entries[*].version}" 2>/dev/null)
            
            
            if [ -n "$all_versions" ]; then
                # Clean up and sort versions
                local versions
                versions=$(echo "$all_versions" | tr ' ' '\n' | sort -V -u | tr '\n' ' ' | xargs)
                echo "VERSIONS_${channel}:$versions"
            else
                    # Fallback to currentCSV
                    local csv
                    csv=$(kubectl get packagemanifest "$package_name" -o jsonpath="{.status.channels[?(@.name=='$channel')].currentCSV}" 2>/dev/null)
                    
                    if [ -n "$csv" ]; then
                        local version
                        version=$(echo "$csv" | sed 's/.*\.v\([0-9]\+\.[0-9]\+\.[0-9]\+.*\)/\1/' 2>/dev/null)
                        
                        if [ -n "$version" ] && [ "$version" != "$csv" ]; then
                            echo "VERSIONS_${channel}:$version"
                        else
                            echo "VERSIONS_${channel}:latest"
                        fi
                    else
                        echo "VERSIONS_${channel}:latest"
                    fi
                fi
        done
        return 0
    else
        print_warning "No channels found in packagemanifest, using fallback"
        echo "CHANNELS:release-v2.7 release-v2.8"
        echo "VERSIONS_release-v2.7:2.7.2"
        echo "VERSIONS_release-v2.8:2.8.5"
        return 0
    fi
}

# Function to cleanup temporary catalog
cleanup_temp_catalog() {
    local temp_namespace="$1"
    
    if [ "$DRY_RUN" = true ]; then
        return 0
    fi

    print_status "Cleaning up temporary catalog..."
    
    # First try normal deletion
    kubectl delete namespace "$temp_namespace" --timeout=30s >/dev/null 2>&1 || {
        print_warning "Normal deletion failed, trying force deletion..."
        # If normal deletion fails, try force deletion
        kubectl delete namespace "$temp_namespace" --force --grace-period=0 >/dev/null 2>&1 || {
            print_warning "Force deletion also failed, namespace may be stuck in terminating state"
            print_status "You may need to manually clean up namespace: $temp_namespace"
        }
    }
}

# Function to interactively select channel
interactive_select_channel() {
    local available_channels="$1"
    
    if [ -z "$available_channels" ]; then
        print_warning "No channels found, using default: $DEFAULT_CHANNEL"
        CHANNEL="$DEFAULT_CHANNEL"
        return 0
    fi
    
    echo ""
    print_status "Available channels:"
    local channels_array=($available_channels)
    local i=1
    
    for channel in "${channels_array[@]}"; do
        echo "  $i) $channel"
        ((i++))
    done
    
    echo ""
    
    while true; do
        # Check if default channel is in available channels
        local default_option=""
        if [[ "$available_channels" == *"$DEFAULT_CHANNEL"* ]]; then
            default_option=" or press Enter for default [$DEFAULT_CHANNEL]"
        else
            default_option=" (no default available)"
        fi
        
        echo -n "Select a channel (1-${#channels_array[@]})$default_option: "
        read -r choice
        
        # Clean up the input (remove any extra whitespace)
        choice=$(echo "$choice" | xargs)
        
        if [ -z "$choice" ]; then
            if [[ "$available_channels" == *"$DEFAULT_CHANNEL"* ]]; then
                CHANNEL="$DEFAULT_CHANNEL"
                break
            else
                echo ""  # Add newline after the prompt
                print_error "No default available. Please select a channel number."
                continue
            fi
        elif [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#channels_array[@]}" ]; then
            CHANNEL="${channels_array[$((choice-1))]}"
            break
        else
            echo ""  # Add newline after the prompt
            print_error "Invalid selection. Please choose 1-${#channels_array[@]}."
        fi
    done
    
    print_success "Selected channel: $CHANNEL"
}

# Function to interactively select version
interactive_select_version() {
    local available_versions="$1"
    
    if [ -z "$available_versions" ]; then
        print_warning "No specific versions found, using latest"
        VERSION=""
        return 0
    fi
    
    echo ""
    print_status "Available versions for channel '$CHANNEL':"
    local versions_array=($available_versions)
    local i=1
    
    for version in "${versions_array[@]}"; do
        echo "  $i) $version"
        ((i++))
    done
    
    echo ""
    
    while true; do
        echo -n "Select a version (1-${#versions_array[@]}) or press Enter for latest: "
        read -r choice
        
        # Clean up the input
        choice=$(echo "$choice" | xargs)
        
        if [ -z "$choice" ]; then
            VERSION=""
            break
        elif [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#versions_array[@]}" ]; then
            VERSION="${versions_array[$((choice-1))]}"
            break
        else
            echo ""  # Add newline after the prompt
            print_error "Invalid selection. Please choose 1-${#versions_array[@]} or press Enter for latest."
        fi
    done
    
    if [ -n "$VERSION" ]; then
        print_success "Selected version: $VERSION"
    else
        print_success "Selected version: latest"
    fi
}

# Function to uninstall MTV operator
uninstall_mtv_operator() {
    print_section "Uninstalling Migration Toolkit for Virtualization Operator"

    # Step 1: Delete ForkliftController instances
    print_status "Deleting ForkliftController instances..."
    if kubectl get forkliftcontroller -n "$FORKLIFT_NAMESPACE" >/dev/null 2>&1; then
        execute_cmd "kubectl delete forkliftcontroller --all -n $FORKLIFT_NAMESPACE --timeout=60s"
        if [ "$DRY_RUN" = false ]; then
            sleep 10  # Give time for cleanup
        fi
    else
        print_status "No ForkliftController instances found"
    fi

    # Step 2: Delete Subscription
    print_status "Deleting operator subscription..."
    
    # Look for both possible subscription names
    local subscription_name=""
    if kubectl get subscription mtv-operator -n "$FORKLIFT_NAMESPACE" >/dev/null 2>&1; then
        subscription_name="mtv-operator"
    elif kubectl get subscription forklift-operator -n "$FORKLIFT_NAMESPACE" >/dev/null 2>&1; then
        subscription_name="forklift-operator"
    fi
    
    if [ -n "$subscription_name" ]; then
        execute_cmd "kubectl delete subscription $subscription_name -n $FORKLIFT_NAMESPACE"
        wait_for_deletion "subscription" "$subscription_name" "$FORKLIFT_NAMESPACE"
    else
        print_status "No MTV/forklift operator subscription found"
    fi

    # Step 3: Delete CSV (ClusterServiceVersion)
    print_status "Deleting ClusterServiceVersion..."
    if [ "$DRY_RUN" = false ]; then
        # Look for MTV or forklift CSV with timeout
        local csv_name
        csv_name=$(timeout 10 kubectl get csv -n "$FORKLIFT_NAMESPACE" -o name 2>/dev/null | grep -E "(mtv|forklift)" | head -1 || true)
        if [ -n "$csv_name" ]; then
            execute_cmd "kubectl delete $csv_name -n $FORKLIFT_NAMESPACE"
            # Wait for CSV deletion
            local csv_short_name
            csv_short_name=$(echo "$csv_name" | cut -d'/' -f2)
            wait_for_deletion "csv" "$csv_short_name" "$FORKLIFT_NAMESPACE"
        else
            print_status "No MTV/forklift CSV found"
        fi
    else
        echo "[DRY-RUN] Would delete MTV/forklift CSV if found"
    fi

    # Step 4: Delete CatalogSource
    print_status "Deleting catalog source..."
    if kubectl get catalogsource konveyor-forklift -n "$FORKLIFT_NAMESPACE" >/dev/null 2>&1; then
        execute_cmd "kubectl delete catalogsource konveyor-forklift -n $FORKLIFT_NAMESPACE"
        wait_for_deletion "catalogsource" "konveyor-forklift" "$FORKLIFT_NAMESPACE"
    else
        print_status "No konveyor-forklift catalog source found"
    fi

    # Step 5: Delete OperatorGroup
    print_status "Deleting operator group..."
    if kubectl get operatorgroup migration -n "$FORKLIFT_NAMESPACE" >/dev/null 2>&1; then
        execute_cmd "kubectl delete operatorgroup migration -n $FORKLIFT_NAMESPACE"
        wait_for_deletion "operatorgroup" "migration" "$FORKLIFT_NAMESPACE"
    else
        print_status "No migration operator group found"
    fi

    # Step 6: Clean up remaining resources
    print_status "Cleaning up remaining MTV resources..."
    
    # Delete any remaining deployments
    if [ "$DRY_RUN" = false ]; then
        local deployments
        deployments=$(kubectl get deployments -n "$FORKLIFT_NAMESPACE" -o name 2>/dev/null | grep -E "(forklift|mtv)" || true)
        if [ -n "$deployments" ]; then
            echo "$deployments" | xargs -r kubectl delete -n "$FORKLIFT_NAMESPACE" --timeout=60s
        fi
    else
        echo "[DRY-RUN] Would delete any remaining forklift/mtv deployments"
    fi

    # Delete any remaining services
    if [ "$DRY_RUN" = false ]; then
        local services
        services=$(kubectl get services -n "$FORKLIFT_NAMESPACE" -o name 2>/dev/null | grep -E "(forklift|mtv)" || true)
        if [ -n "$services" ]; then
            echo "$services" | xargs -r kubectl delete -n "$FORKLIFT_NAMESPACE" --timeout=30s
        fi
    else
        echo "[DRY-RUN] Would delete any remaining forklift/mtv services"
    fi

    # Step 7: Optionally delete namespaces (only if they're empty or we created them)
    print_status "Checking if namespaces should be cleaned up..."
    if [ "$DRY_RUN" = false ]; then
        # Check if namespace has only default resources
        local resource_count
        resource_count=$(kubectl get all -n "$FORKLIFT_NAMESPACE" --no-headers 2>/dev/null | wc -l)
        if [ "$resource_count" -eq 0 ]; then
            print_status "Namespace $FORKLIFT_NAMESPACE is empty, considering deletion..."
            read -p "Delete empty namespace $FORKLIFT_NAMESPACE? [y/N]: " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                execute_cmd "kubectl delete namespace $FORKLIFT_NAMESPACE"
            fi
        else
            print_status "Namespace $FORKLIFT_NAMESPACE has remaining resources, keeping it"
        fi
    else
        echo "[DRY-RUN] Would check if namespace $FORKLIFT_NAMESPACE should be deleted"
    fi

    print_success "MTV operator uninstallation completed"
}

# Function to install MTV operator
install_mtv_operator() {
    print_section "Installing Migration Toolkit for Virtualization Operator"

    # Step 1: Create namespace
    print_status "Creating namespace $FORKLIFT_NAMESPACE..."
    execute_cmd "kubectl create namespace $FORKLIFT_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -"

    # Step 2: Create CatalogSource with IIB image
    print_status "Creating catalog source with IIB image: $IIB_IMAGE..."
    
    local catalog_source_yaml
    catalog_source_yaml=$(cat << EOF
apiVersion: operators.coreos.com/v1alpha1
kind: CatalogSource
metadata:
  name: konveyor-forklift
  namespace: ${FORKLIFT_NAMESPACE}
spec:
  displayName: Migration Toolkit for Virtualization Operator
  publisher: Red Hat
  sourceType: grpc
  image: ${IIB_IMAGE}
  updateStrategy:
    registryPoll:
      interval: 30m
EOF
)

    if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] Would create CatalogSource:"
        echo "$catalog_source_yaml"
    else
        echo "$catalog_source_yaml" | kubectl apply -f -
        wait_for_resource "catalogsource" "konveyor-forklift" "$FORKLIFT_NAMESPACE"
        
        # Always query packagemanifest for actual versions in interactive mode
        if [ "$INTERACTIVE" = true ]; then
            print_status "Querying packagemanifest for available versions..."
            query_result=$(create_temp_catalog_and_query)
            query_exit_code=$?
            
            if [ $query_exit_code -eq 0 ] && [ -n "$query_result" ]; then
                print_success "Successfully queried packagemanifest for available options"
                
                # Parse the results
                available_channels=$(echo "$query_result" | grep "^CHANNELS:" | cut -d':' -f2- | xargs)
                
                # Interactive channel selection (if not already specified)
                if [ "$CHANNEL" = "$DEFAULT_CHANNEL" ] && [ -n "$available_channels" ]; then
                    interactive_select_channel "$available_channels"
                elif [ -n "$available_channels" ] && [[ ! "$available_channels" == *"$CHANNEL"* ]]; then
                    print_warning "Current channel '$CHANNEL' not found in available channels: $available_channels"
                    interactive_select_channel "$available_channels"
                fi
                
                # Interactive version selection based on selected channel
                if [ -z "$VERSION" ]; then
                    # Look for specific versions for the selected channel from packagemanifest
                    grep_result=$(printf '%s\n' "$query_result" | grep "^VERSIONS_${CHANNEL}:" || echo "NO_MATCH")
                    
                    if [ "$grep_result" != "NO_MATCH" ]; then
                        channel_versions=$(echo "$grep_result" | cut -d':' -f2- | xargs)
                    else
                        channel_versions=""
                    fi
                    
                    # Show version selection if we have actual versions (not just "latest")
                    if [ -n "$channel_versions" ] && [ "$channel_versions" != "latest" ]; then
                        interactive_select_version "$channel_versions"
                    else
                        print_status "Using default version for channel '$CHANNEL'"
                        VERSION=""  # Let the operator choose the default version
                    fi
                fi
            else
                print_warning "Failed to query packagemanifest, using defaults"
            fi
        fi
    fi

    # Step 3: Create OperatorGroup
    print_status "Creating operator group..."
    
    local operator_group_yaml
    operator_group_yaml=$(cat << EOF
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: migration
  namespace: ${FORKLIFT_NAMESPACE}
spec:
  targetNamespaces:
    - ${FORKLIFT_NAMESPACE}
EOF
)

    if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] Would create OperatorGroup:"
        echo "$operator_group_yaml"
    else
        echo "$operator_group_yaml" | kubectl apply -f -
    fi

    # Step 4: Create Subscription
    print_status "Creating subscription with channel: $CHANNEL..."
    
    local subscription_yaml
    subscription_yaml=$(cat << EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: mtv-operator
  namespace: ${FORKLIFT_NAMESPACE}
spec:
  channel: ${CHANNEL}
  installPlanApproval: Automatic
  name: mtv-operator
  source: konveyor-forklift
  sourceNamespace: ${FORKLIFT_NAMESPACE}
EOF
)

    # Add version if specified
    if [ -n "$VERSION" ]; then
        subscription_yaml=$(echo "$subscription_yaml" | sed "/sourceNamespace:/a\\  startingCSV: mtv-operator.v${VERSION}")
    fi

    if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] Would create Subscription:"
        echo "$subscription_yaml"
    else
        echo "$subscription_yaml" | kubectl apply -f -
    fi

    # Step 5: Wait for operator to be ready
    if [ "$DRY_RUN" = false ]; then
        print_status "Waiting for MTV operator to be installed..."
        
        # Wait for CSV to be created and succeed
        local csv_name=""
        local count=0
        local max_wait=300
        
        while [ -z "$csv_name" ] && [ $count -lt $max_wait ]; do
            csv_name=$(kubectl get csv -n "$FORKLIFT_NAMESPACE" -o name 2>/dev/null | grep -E "(mtv|forklift)" | head -1 | cut -d'/' -f2)
            if [ -z "$csv_name" ]; then
                sleep 10
                ((count+=10))
            fi
        done
        
        if [ -n "$csv_name" ]; then
            print_status "Found CSV: $csv_name"
            kubectl wait csv "$csv_name" -n "$FORKLIFT_NAMESPACE" --for=jsonpath='{.status.phase}'=Succeeded --timeout="$TIMEOUT"
            print_success "MTV operator installed successfully"
        else
            print_error "Timeout waiting for CSV to be created"
            return 1
        fi
        
        # Wait for operator deployment (try both mtv-operator and forklift-operator names)
        local deployment_name=""
        if kubectl get deployment mtv-operator -n "$FORKLIFT_NAMESPACE" >/dev/null 2>&1; then
            deployment_name="mtv-operator"
        elif kubectl get deployment forklift-operator -n "$FORKLIFT_NAMESPACE" >/dev/null 2>&1; then
            deployment_name="forklift-operator"
        else
            # Find any deployment with mtv or forklift in the name
            deployment_name=$(kubectl get deployments -n "$FORKLIFT_NAMESPACE" -o name 2>/dev/null | grep -E "(mtv|forklift)" | head -1 | cut -d'/' -f2)
        fi
        
        if [ -n "$deployment_name" ]; then
            wait_for_resource "deployment" "$deployment_name" "$FORKLIFT_NAMESPACE" "condition=Available=True"
        else
            print_warning "Could not find MTV/Forklift operator deployment"
        fi
    else
        echo "[DRY-RUN] Would wait for MTV operator installation to complete"
    fi

    # Step 6: Create migration namespace
    print_status "Creating migration namespace $MIGRATION_NAMESPACE..."
    execute_cmd "kubectl create namespace $MIGRATION_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -"

    print_success "MTV operator installation completed"
}

# Function to create ForkliftController instance
create_forklift_controller() {
    print_section "Creating ForkliftController Instance"

    local controller_yaml
    controller_yaml=$(cat << EOF
apiVersion: forklift.konveyor.io/v1beta1
kind: ForkliftController
metadata:
  name: forklift-controller
  namespace: ${FORKLIFT_NAMESPACE}
spec:
  feature_ui: false
  feature_ui_plugin: false
  feature_auth_required: false
  feature_validation: true
  ui_tls_enabled: false
  inventory_container_requests_cpu: "50m"
  validation_container_requests_cpu: "50m"
  controller_container_requests_cpu: "50m"
  api_container_requests_cpu: "50m"
EOF
)

    if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] Would create ForkliftController:"
        echo "$controller_yaml"
    else
        echo "$controller_yaml" | kubectl apply -f -
        
        # Wait for forklift services to be ready
        wait_for_resource "service" "forklift-inventory" "$FORKLIFT_NAMESPACE"
        wait_for_resource "service" "forklift-services" "$FORKLIFT_NAMESPACE"
        
        # Expose services on NodePort (matching existing pattern)
        print_status "Exposing forklift services..."
        kubectl patch service -n "$FORKLIFT_NAMESPACE" forklift-inventory --type='merge' \
          -p '{"spec":{"type":"NodePort","ports":[{"name":"api-https","protocol":"TCP","targetPort":8443,"port":8443,"nodePort":30444}]}}'
        
        kubectl patch service -n "$FORKLIFT_NAMESPACE" forklift-services --type='merge' \
          -p '{"spec":{"type":"NodePort","ports":[{"name":"api-https","protocol":"TCP","targetPort":8443,"port":8443,"nodePort":30446}]}}'
    fi

    print_success "ForkliftController instance created successfully"
}

# Function to verify installation
verify_installation() {
    print_section "Verifying Installation"

    if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] Would verify installation"
        return 0
    fi

    print_status "Checking operator status..."
    
    # Check CSV status
    local csv_status
    csv_status=$(kubectl get csv -n "$FORKLIFT_NAMESPACE" -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "NotFound")
    echo "CSV Status: $csv_status"
    
    # Check deployments
    echo "Deployments in $FORKLIFT_NAMESPACE:"
    kubectl get deployments -n "$FORKLIFT_NAMESPACE" -o wide
    
    # Check services
    echo "Services in $FORKLIFT_NAMESPACE:"
    kubectl get services -n "$FORKLIFT_NAMESPACE"
    
    # Check ForkliftController
    echo "ForkliftController status:"
    kubectl get forkliftcontroller -n "$FORKLIFT_NAMESPACE" -o wide
    
    if [ "$csv_status" = "Succeeded" ]; then
        print_success "Installation verification completed successfully"
    else
        print_error "Installation verification failed - CSV status: $csv_status"
        return 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --iib-image)
            IIB_IMAGE="$2"
            shift 2
            ;;
        --channel)
            CHANNEL="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --namespace)
            FORKLIFT_NAMESPACE="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --interactive)
            INTERACTIVE=true
            shift
            ;;
        --non-interactive)
            INTERACTIVE=false
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$IIB_IMAGE" ]; then
    print_error "IIB image is required. Use --iib-image to specify it."
    show_help
    exit 1
fi

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check cluster connectivity
if [ "$DRY_RUN" = false ]; then
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
fi

# Interactive selection of channel and version if enabled
if [ "$INTERACTIVE" = true ] && [ "$DRY_RUN" = false ]; then
    print_section "Interactive Channel and Version Selection"
    
    print_status "Querying IIB image for available channels and versions..."
    
    # Automatically query the IIB image (assume 'y')
    if true; then
        print_status "Querying IIB image (this may take up to 3 minutes)..."
        
        # Query the IIB image directly first (faster and more reliable)
        query_result=$(query_iib_image_direct "$IIB_IMAGE")
        query_exit_code=$?
        
        
        if [ $query_exit_code -eq 0 ] && [ -n "$query_result" ]; then
            print_success "Successfully queried IIB image for available options"
            
            # Parse the results
            available_channels=$(echo "$query_result" | grep "^CHANNELS:" | cut -d':' -f2- | xargs)
        else
            print_warning "Direct IIB query failed, will query after catalog source creation"
        fi
        
        if [ -n "$available_channels" ]; then
            
            # Interactive channel selection (if not already specified)
            if [ "$CHANNEL" = "$DEFAULT_CHANNEL" ] && [ -n "$available_channels" ]; then
                interactive_select_channel "$available_channels"
            elif [ -n "$available_channels" ] && [[ ! "$available_channels" == *"$CHANNEL"* ]]; then
                print_warning "Current channel '$CHANNEL' not found in available channels: $available_channels"
                interactive_select_channel "$available_channels"
            fi
            
            # Version selection will happen after catalog source creation to get actual versions
            if [ -z "$VERSION" ]; then
                print_status "Version selection will be available after catalog source creation"
            fi
            
        else
            print_warning "Query failed or timed out. Using manual selection instead."
            # Fall through to manual selection
        fi
    else
        print_warning "IIB query was skipped. Using manual selection instead."
    fi
    
    # Manual selection if query was skipped or failed
    if [ $query_exit_code -ne 0 ] || [ -z "$query_result" ]; then
        print_status "Manual channel and version selection"
        echo ""
        echo "Common MTV operator channels:"
        echo "  1) development"
        echo "  2) dev-preview"
        echo "  3) stable-v2.6"
        echo "  4) stable-v2.7"
        echo "  5) stable-v2.8"
        echo "  6) stable-v2.9"
        echo "  7) stable-v2.10"
        echo ""
        
        while true; do
            read -p "Select a channel (1-7) or press Enter for current [$CHANNEL]: " choice
            
            if [ -z "$choice" ]; then
                break
            elif [ "$choice" = "1" ]; then
                CHANNEL="development"
                break
            elif [ "$choice" = "2" ]; then
                CHANNEL="dev-preview"
                break
            elif [ "$choice" = "3" ]; then
                CHANNEL="stable-v2.6"
                break
            elif [ "$choice" = "4" ]; then
                CHANNEL="stable-v2.7"
                break
            elif [ "$choice" = "5" ]; then
                CHANNEL="stable-v2.8"
                break
            elif [ "$choice" = "6" ]; then
                CHANNEL="stable-v2.9"
                break
            elif [ "$choice" = "7" ]; then
                CHANNEL="stable-v2.10"
                break
            else
                print_error "Invalid selection. Please choose 1-7 or press Enter."
            fi
        done
        
        print_success "Selected channel: $CHANNEL"
        
        # Version selection
        echo ""
        echo "Version selection:"
        echo "  1) latest (recommended)"
        echo "  2) Enter specific version (e.g., 2.10.0)"
        echo ""
        
        while true; do
            read -p "Select version option (1-2) or press Enter for latest: " choice
            
            if [ -z "$choice" ] || [ "$choice" = "1" ]; then
                VERSION=""
                print_success "Selected version: latest"
                break
            elif [ "$choice" = "2" ]; then
                read -p "Enter specific version (e.g., 2.10.0): " VERSION
                if [ -n "$VERSION" ]; then
                    print_success "Selected version: $VERSION"
                    break
                else
                    print_error "Please enter a valid version."
                fi
            else
                print_error "Invalid selection. Please choose 1-2 or press Enter."
            fi
        done
    fi
elif [ "$INTERACTIVE" = true ] && [ "$DRY_RUN" = true ]; then
use     print_status "Interactive mode disabled in dry-run mode"
fi

# Main execution
print_section "Migration Toolkit for Virtualization Operator Reinstall"
echo "IIB Image: $IIB_IMAGE"
echo "Channel: $CHANNEL"
echo "Version: ${VERSION:-latest}"
echo "Namespace: $FORKLIFT_NAMESPACE"
echo "Timeout: $TIMEOUT"
echo "Interactive Mode: $INTERACTIVE"
echo "Dry Run: $DRY_RUN"

if [ "$DRY_RUN" = false ]; then
    echo ""
    read -p "Do you want to proceed with the reinstallation? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Operation cancelled by user"
        exit 0
    fi
fi

# Execute the reinstallation process
uninstall_mtv_operator
install_mtv_operator
create_forklift_controller
verify_installation

print_section "Reinstallation Complete"
print_success "Migration Toolkit for Virtualization Operator has been successfully reinstalled!"

if [ "$DRY_RUN" = false ]; then
    echo ""
    echo "Next steps:"
    echo "1. Verify the operator is working correctly"
    echo "2. Create provider connections as needed"
    echo "3. Configure network and storage mappings"
    echo "4. Create and execute migration plans"
    echo ""
    echo "Access the forklift services at:"
    echo "- Inventory API: https://<cluster-ip>:30444"
    echo "- Services API: https://<cluster-ip>:30446"
fi
 a chaybei