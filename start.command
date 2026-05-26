#!/bin/bash
cd "$(dirname "$0")"
node -e "require('./controller/controller').startServer()" &
sleep 2
open http://localhost:3000