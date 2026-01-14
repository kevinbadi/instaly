#!/bin/bash
# Instaly Campaign Worker - Service Setup Script
# Run this on your Mac Mini to set up the campaign worker as a background service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_NAME="com.instaly.campaignworker.plist"
PLIST_SOURCE="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"
LOGS_DIR="$SCRIPT_DIR/logs"

echo "🚀 Instaly Campaign Worker Setup"
echo "================================="
echo ""

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p "$LOGS_DIR"

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r "$SCRIPT_DIR/requirements.txt" --quiet

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
python3 -m playwright install chromium

# Copy plist to LaunchAgents
echo "📋 Installing launch agent..."
cp "$PLIST_SOURCE" "$PLIST_DEST"

# Update the plist with correct Python path
PYTHON_PATH=$(which python3)
echo "   Using Python: $PYTHON_PATH"

# Load the service
echo "▶️  Starting campaign worker service..."
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo ""
echo "✅ Campaign Worker service installed and started!"
echo ""
echo "📊 Useful commands:"
echo "   Check status:  launchctl list | grep instaly"
echo "   View logs:     tail -f $LOGS_DIR/campaign_worker.log"
echo "   Stop service:  launchctl unload $PLIST_DEST"
echo "   Start service: launchctl load $PLIST_DEST"
echo ""
echo "The worker will now automatically:"
echo "   • Run when your Mac starts"
echo "   • Poll for active campaigns every 60 seconds"
echo "   • Send DMs for any active campaigns"
echo "   • Restart if it crashes"
echo ""






