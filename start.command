#!/bin/bash
cd "$(dirname "$0")"
colima start
sleep 5
osascript -e 'tell application "Terminal" to do script "sqlcmd -S localhost,1433 -U sa -P Ch33s3burg3r! -C -No"'
# Start the backend server (injects API_URI into main.js automatically)
node -e "require('./controller/controller').startServer()" &
sleep 2
zrok share reserved barangayworks
killall sqlcmd 2>/dev/null; osascript -e 'tell application "Terminal" to close front window saving no'
npm stop