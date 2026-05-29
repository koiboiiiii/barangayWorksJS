#!/bin/bash
cd "$(dirname "$0")"
colima start
sqlcmd -S localhost -U sa -P Ch33s3burger!
# Start the backend server (injects API_URI into main.js automatically)
node -e "require('./controller/controller').startServer()" &
sleep 2
zrok share reserved barangayworks