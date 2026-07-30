#!/bin/sh
set -eu

echo "Applying Prisma schema..."
node node_modules/prisma/build/index.js db push --skip-generate

echo "Starting Next.js..."
exec node server.js
