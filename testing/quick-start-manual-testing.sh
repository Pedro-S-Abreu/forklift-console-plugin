#!/bin/bash

# Quick Start Script for Manual Testing Utility
# This script demonstrates how to use the manual testing utility

set -e

echo "🚀 Forklift Manual Testing Utility - Quick Start"
echo "================================================"
echo

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the testing directory"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo
fi

# Show available commands
echo "📋 Available Commands:"
echo "  npm run create-resources                    # Create provider and plan with defaults"
echo "  npm run create-resources -- --provider-only # Create provider only"
echo "  npm run create-resources -- --help         # Show detailed help"
echo "  npm run cleanup-resources                   # Clean up created resources"
echo

# Check if .providers.json exists
if [ ! -f ".providers.json" ]; then
    echo "⚠️  .providers.json not found. The utility will create a template on first run."
    echo "   You'll need to edit it with your actual provider configurations."
    echo
    
    read -p "🤔 Would you like to run the utility now to create the template? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔧 Creating .providers.json template..."
        npm run create-resources -- --help > /dev/null 2>&1 || true
        
        if [ -f ".providers.json" ]; then
            echo "✅ Template created! Please edit .providers.json with your provider configurations."
            echo "   Example providers are already included - just update the credentials."
        fi
    fi
else
    echo "✅ .providers.json found!"
    echo
    
    # Show available provider keys
    echo "📡 Available Provider Configurations:"
    if command -v jq >/dev/null 2>&1; then
        jq -r 'keys[]' .providers.json | sed 's/^/   - /'
    else
        echo "   (Install 'jq' to see provider keys, or check .providers.json manually)"
    fi
    echo
    
    read -p "🚀 Would you like to create test resources now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🎯 Creating test resources..."
        echo "   (This will open a browser and create a provider and plan)"
        echo
        
        # Ask for headless mode
        read -p "🎭 Run in headless mode? (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            npm run create-resources -- --headless false
        else
            npm run create-resources
        fi
        
        echo
        echo "🎉 Resources created! Check created-resources.json for details."
        echo "🧹 Run 'npm run cleanup-resources' when you're done testing."
    fi
fi

echo
echo "📚 For more advanced usage, see MANUAL_TESTING_UTILITY.md"
echo "🔧 Example configurations are in config-examples/"
echo
echo "Happy testing! 🎉"
