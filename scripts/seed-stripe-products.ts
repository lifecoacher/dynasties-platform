import { getUncachableStripeClient } from '../artifacts/api-server/src/stripeClient';

const PLANS = [
  {
    name: 'Dynasties Starter',
    description: 'For small forwarders getting started with digital operations',
    metadata: {
      planType: 'STARTER',
      features: JSON.stringify([
        '3 team members',
        '50 shipments/month',
        'Basic document generation',
        'Email support',
      ]),
    },
    monthlyPrice: 4900,
    yearlyPrice: 47000,
  },
  {
    name: 'Dynasties Growth',
    description: 'For growing operations needing more capacity and intelligence',
    metadata: {
      planType: 'GROWTH',
      features: JSON.stringify([
        '10 team members',
        '250 shipments/month',
        'AI routing & pricing',
        'Compliance screening',
        'Priority support',
      ]),
    },
    monthlyPrice: 14900,
    yearlyPrice: 143000,
  },
  {
    name: 'Dynasties Scale',
    description: 'For established forwarders with high volume operations',
    metadata: {
      planType: 'SCALE',
      features: JSON.stringify([
        '25 team members',
        '1,000 shipments/month',
        'Full decision engine',
        'Reconciliation engine',
        'Dedicated support',
      ]),
    },
    monthlyPrice: 39900,
    yearlyPrice: 383000,
  },
  {
    name: 'Dynasties Enterprise',
    description: 'Unlimited capacity with white-glove onboarding and custom integrations',
    metadata: {
      planType: 'ENTERPRISE',
      features: JSON.stringify([
        'Unlimited team members',
        'Unlimited shipments',
        'Custom integrations',
        'Dedicated success manager',
        'SLA guarantee',
      ]),
    },
    monthlyPrice: 99900,
    yearlyPrice: 959000,
  },
];

async function seedProducts() {
  const stripe = await getUncachableStripeClient();
  console.log('Seeding Stripe products...\n');

  for (const plan of PLANS) {
    const existing = await stripe.products.search({
      query: `name:'${plan.name}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(`[skip] ${plan.name} already exists (${existing.data[0].id})`);
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: plan.metadata,
    });
    console.log(`[created] ${plan.name} (${product.id})`);

    const monthly = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.monthlyPrice,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { planType: plan.metadata.planType, interval: 'month' },
    });
    console.log(`  monthly: $${(plan.monthlyPrice / 100).toFixed(2)}/mo (${monthly.id})`);

    const yearly = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.yearlyPrice,
      currency: 'usd',
      recurring: { interval: 'year' },
      metadata: { planType: plan.metadata.planType, interval: 'year' },
    });
    console.log(`  yearly: $${(plan.yearlyPrice / 100).toFixed(2)}/yr (${yearly.id})`);
  }

  console.log('\nDone! Webhooks will sync products to the database.');
}

seedProducts().catch((err) => {
  console.error('Error seeding products:', err);
  process.exit(1);
});
