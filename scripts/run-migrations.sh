#!/bin/bash
set -euo pipefail

echo "=== Dynasties Migration Runner ==="
echo "Environment: ${NODE_ENV:-development}"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required"
  exit 1
fi

echo "Running Drizzle migrations..."
cd "$(dirname "$0")/../lib/db"
npx drizzle-kit migrate 2>&1

echo "Migrations complete."

if [ -n "${STRIPE_SECRET_KEY:-}" ] || [ -n "${REPLIT_CONNECTORS_HOSTNAME:-}" ]; then
  echo "Running Stripe schema migrations..."
  cd "$(dirname "$0")/../artifacts/api-server"
  node -e "
    import('stripe-replit-sync').then(m => {
      m.runMigrations({ databaseUrl: process.env.DATABASE_URL }).then(() => {
        console.log('Stripe schema ready');
        process.exit(0);
      });
    }).catch(err => {
      console.warn('Stripe migration skipped:', err.message);
      process.exit(0);
    });
  " 2>&1 || true
fi

echo "=== Migration Runner Complete ==="
