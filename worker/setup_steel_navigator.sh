#!/bin/bash
# Instaly Steel Navigator - Service Setup Script
# Run this on your Mac Mini to set up the Steel browser navigation worker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_NAME="com.instaly.steelnavigator.plist"
PLIST_SOURCE="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"
LOGS_DIR="$SCRIPT_DIR/logs"

echo "🚀 Instaly Steel Navigator Setup"
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
mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SOURCE" "$PLIST_DEST"

# Stop existing service if running
echo "▶️  Starting Steel Navigator service..."
launchctl unload "$PLIST_DEST" 2>/dev/null || true

# Load the service
launchctl load "$PLIST_DEST"

echo ""
echo "✅ Steel Navigator service installed and started!"
echo ""
echo "📊 Useful commands:"
echo "   Check status:  launchctl list | grep steelnavigator"
echo "   View logs:     tail -f $LOGS_DIR/steel_navigator.log"
echo "   Stop service:  launchctl unload $PLIST_DEST"
echo "   Start service: launchctl load $PLIST_DEST"
echo ""
echo "The Steel Navigator will now automatically:"
echo "   • Run when your Mac starts"
echo "   • Poll for pending browser navigation tasks every 2 seconds"
echo "   • Navigate Steel browsers to Instagram for session capture"
echo "   • Restart immediately if it crashes"
echo ""




