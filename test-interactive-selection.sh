#!/bin/bash

# Test script to demonstrate the interactive channel and version selection
# This script shows what the interactive mode would look like

echo "🧪 Testing Interactive Channel and Version Selection"
echo "=================================================="

# Mock available channels and versions
MOCK_CHANNELS="development stable-v2.6 stable-v2.7 stable-v2.8"
MOCK_VERSIONS_DEV="2.9.0-dev 2.8.1-dev"
MOCK_VERSIONS_STABLE="2.6.0 2.6.1 2.6.2"

# Function to simulate interactive channel selection
test_channel_selection() {
    echo ""
    echo "📋 Available channels:"
    local channels_array=($MOCK_CHANNELS)
    local i=1
    
    for channel in "${channels_array[@]}"; do
        echo "  $i) $channel"
        ((i++))
    done
    
    echo ""
    echo "This is what the interactive selection would look like:"
    echo "Select a channel (1-${#channels_array[@]}) or press Enter for default [development]: "
    echo ""
    echo "Example selections:"
    echo "  - Press Enter → development (default)"
    echo "  - Type '2' → stable-v2.6"
    echo "  - Type '3' → stable-v2.7"
    echo "  - Type '4' → stable-v2.8"
}

# Function to simulate interactive version selection
test_version_selection() {
    local channel="$1"
    local versions="$2"
    
    echo ""
    echo "📦 Available versions for channel '$channel':"
    local versions_array=($versions)
    local i=1
    
    for version in "${versions_array[@]}"; do
        echo "  $i) $version"
        ((i++))
    done
    
    echo ""
    echo "This is what the version selection would look like:"
    echo "Select a version (1-${#versions_array[@]}) or press Enter for latest: "
    echo ""
    echo "Example selections:"
    echo "  - Press Enter → latest"
    echo "  - Type '1' → ${versions_array[0]}"
    if [ ${#versions_array[@]} -gt 1 ]; then
        echo "  - Type '2' → ${versions_array[1]}"
    fi
}

# Main demonstration
echo ""
echo "🎯 Scenario 1: Interactive mode with development channel"
test_channel_selection
test_version_selection "development" "$MOCK_VERSIONS_DEV"

echo ""
echo "🎯 Scenario 2: Interactive mode with stable channel"
test_version_selection "stable-v2.6" "$MOCK_VERSIONS_STABLE"

echo ""
echo "📝 Usage Examples:"
echo ""
echo "1. Interactive mode (default):"
echo "   ./reinstall-mtv-operator.sh --iib-image registry.redhat.io/redhat/redhat-operator-index:v4.14"
echo ""
echo "2. Non-interactive mode with specific values:"
echo "   ./reinstall-mtv-operator.sh \\"
echo "     --iib-image registry.redhat.io/redhat/redhat-operator-index:v4.14 \\"
echo "     --channel stable-v2.6 \\"
echo "     --version 2.6.2 \\"
echo "     --non-interactive"
echo ""
echo "3. Dry-run to see what would happen:"
echo "   ./reinstall-mtv-operator.sh \\"
echo "     --iib-image registry.redhat.io/redhat/redhat-operator-index:v4.14 \\"
echo "     --dry-run"
echo ""
echo "✨ The script will:"
echo "   • Query the IIB image for available channels and versions"
echo "   • Present interactive menus for selection"
echo "   • Validate selections against available options"
echo "   • Proceed with uninstall and reinstall using selected values"
