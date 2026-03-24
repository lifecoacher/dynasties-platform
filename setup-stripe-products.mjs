// This script creates products and prices on the new Stripe account
// It uses the same connector credentials the app uses

async function getStripeClient() {
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
  const settings = data.items?.[0]?.settings;
  if (!settings?.secret) throw new Error('No Stripe secret key');
  
  const { default: Stripe } = await import('stripe');
  return new Stripe(settings.secret, { apiVersion: '2025-08-27.basil' });
}

async function main() {
  const stripe = await getStripeClient();
  
  // Verify account
  const acct = await stripe.accounts.retrieve();
  console.log('Stripe Account:', acct.id);
  
  // Check if products already exist on this account
  const existing = await stripe.products.list({ limit: 20 });
  console.log('Existing products:', existing.data.length);
  if (existing.data.some(p => p.metadata?.planType)) {
    console.log('Products with planType metadata already exist:');
    for (const p of existing.data.filter(pp => pp.metadata?.planType)) {
      console.log(` - ${p.name} (${p.id}) planType=${p.metadata.planType}`);
    }
    console.log('Skipping product creation. Proceeding to sync.');
    return;
  }

  const plans = [
    { name: 'Dynasties Starter', planType: 'STARTER', monthlyPrice: 24900, features: '["3 team members","40 shipments/month","Basic document generation","Email support"]' },
    { name: 'Dynasties Growth', planType: 'GROWTH', monthlyPrice: 89500, features: '["10 team members","250 shipments/month","AI routing & pricing","Compliance screening","Priority support"]' },
    { name: 'Dynasties Scale', planType: 'SCALE', monthlyPrice: 240000, features: '["25 team members","1,000 shipments/month","Full decision engine","Reconciliation engine","Dedicated support"]' },
    { name: 'Dynasties Enterprise', planType: 'ENTERPRISE', monthlyPrice: 0, features: '["Unlimited team members","Unlimited shipments","Custom integrations","Dedicated success manager","SLA guarantee"]' },
  ];

  const deploymentFees = [
    { name: 'Growth Deployment Fee', planType: 'GROWTH', price: 150000 },
    { name: 'Scale Deployment Fee', planType: 'SCALE', price: 350000 },
  ];

  for (const plan of plans) {
    console.log(`Creating product: ${plan.name}...`);
    const product = await stripe.products.create({
      name: plan.name,
      metadata: { planType: plan.planType, features: plan.features },
    });
    console.log(`  Product: ${product.id}`);

    if (plan.monthlyPrice > 0) {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthlyPrice,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { priceType: 'subscription' },
      });
      console.log(`  Price: ${price.id} ($${plan.monthlyPrice / 100}/mo)`);
    }
  }

  for (const fee of deploymentFees) {
    console.log(`Creating deployment fee product: ${fee.name}...`);
    const product = await stripe.products.create({
      name: fee.name,
      metadata: { planType: fee.planType, priceType: 'deployment_fee' },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: fee.price,
      currency: 'usd',
      metadata: { priceType: 'deployment_fee' },
    });
    console.log(`  Product: ${product.id}, Price: ${price.id} ($${fee.price / 100})`);
  }

  console.log('\nAll products and prices created successfully!');
}

main().catch(e => { console.error(e); process.exit(1); });
