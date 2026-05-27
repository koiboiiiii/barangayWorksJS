#!/bin/bash
cd "$(dirname "$0")"
# Start the backend server (injects API_URI into main.js automatically)
node -e "require('./controller/controller').startServer()" &
sleep 2
open http://localhost:3000
