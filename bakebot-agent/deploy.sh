#!/bin/bash

# BakeBot Agent Deployment Script

set -e

echo "🚀 Deploying BakeBot Agent to LiveKit Cloud..."

# Check if livekit-cli is installed
if ! command -v livekit-cli &> /dev/null; then
    echo "❌ livekit-cli not found. Please install it first:"
    echo "pip install livekit-cli"
    exit 1
fi

# Check environment variables
if [ -z "$LIVEKIT_API_KEY" ] || [ -z "$LIVEKIT_API_SECRET" ]; then
    echo "❌ Missing required environment variables:"
    echo "- LIVEKIT_API_KEY"
    echo "- LIVEKIT_API_SECRET"
    echo ""
    echo "Please set these in your .env file or environment."
    exit 1
fi

# Deploy the agent
echo "📦 Building and deploying agent..."
livekit-cli deploy-agent

echo "✅ BakeBot Agent deployed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Test the agent deployment in LiveKit Cloud dashboard"
echo "2. Update your frontend to use the new agent URL"
echo "3. Test the full integration"