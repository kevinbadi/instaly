#!/bin/bash
# Stop the Instaly Campaign Worker service

PLIST_NAME="com.instaly.campaignworker.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "⏹️  Stopping Instaly Campaign Worker..."
launchctl unload "$PLIST_DEST" 2>/dev/null || echo "Service was not running"
echo "✅ Service stopped"

