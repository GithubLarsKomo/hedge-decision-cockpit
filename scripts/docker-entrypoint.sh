#!/bin/sh
set -eu

echo "Applying Prisma schema..."
npx prisma db push --skip-generate

echo "Starting Next.js..."
exec node server.js
