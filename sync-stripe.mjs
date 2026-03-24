async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', 'development');
  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json', 'X-Replit-Token': xReplitToken }
  });
  const data = await response.json();
  return data.items?.[0]?.settings?.secret;
}

async function main() {
  const secretKey = await getCredentials();
  const { StripeSync } = await import('stripe-replit-sync');
  const sync = new StripeSync({
    poolConfig: { connectionString: process.env.DATABASE_URL, max: 2 },
    stripeSecretKey: secretKey,
  });

  console.log('Syncing products...');
  await sync.syncProducts();
  console.log('Syncing prices...');
  await sync.syncPrices();
  console.log('Sync complete!');

  const pg = await import('pg');
  const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
  const products = await pool.query('SELECT id, name, metadata FROM stripe.products WHERE active = true');
  console.log('\nSynced products:');
  for (const p of products.rows) {
    console.log(`  ${p.name} (${p.id}) planType=${p.metadata?.planType}`);
  }
  const prices = await pool.query('SELECT id, product, unit_amount, recurring FROM stripe.prices WHERE active = true');
  console.log('\nSynced prices:');
  for (const p of prices.rows) {
    console.log(`  ${p.id} product=${p.product} amount=${p.unit_amount}`);
  }
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
