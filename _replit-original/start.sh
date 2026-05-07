#!/bin/bash
set -e

# Start backend API server on port 3001
PORT=3001 node server/src/index.js &
SERVER_PID=$!

echo "API server starting on port 3001..."
sleep 2

# Start Vite dev server on port 5000 (vite [root] syntax for Vite 5+)
echo "Starting Vite dev server on port 5000..."
./node_modules/.bin/vite client --config client/vite.config.ts

# Cleanup
kill $SERVER_PID 2>/dev/null || true
