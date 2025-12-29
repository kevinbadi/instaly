#!/usr/bin/env python3
"""
Steel Navigator API
Runs on Mac Mini to handle Steel browser navigation via Puppeteer
"""

import os
import subprocess
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)  # Allow requests from Vercel

STEEL_API_KEY = os.getenv("STEEL_API_KEY")

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/navigate", methods=["POST"])
def navigate():
    """Navigate a Steel session to Instagram login"""
    try:
        data = request.json
        session_id = data.get("sessionId")
        
        if not session_id:
            return jsonify({"error": "Missing sessionId"}), 400
        
        if not STEEL_API_KEY:
            return jsonify({"error": "STEEL_API_KEY not configured"}), 500
        
        # Run the Node.js navigation script
        script_path = os.path.join(os.path.dirname(__file__), "navigate-steel.js")
        
        result = subprocess.run(
            ["node", script_path, session_id, STEEL_API_KEY],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        # Parse the output
        try:
            output = json.loads(result.stdout.strip())
            if output.get("success"):
                return jsonify({"success": True, "message": "Navigated to Instagram"})
            else:
                return jsonify({"success": False, "error": output.get("error", "Unknown error")}), 500
        except json.JSONDecodeError:
            return jsonify({
                "success": False, 
                "error": result.stderr or result.stdout or "Script failed"
            }), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Navigation timed out"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.getenv("NAVIGATOR_PORT", 5001))
    print(f"🚀 Steel Navigator running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)

