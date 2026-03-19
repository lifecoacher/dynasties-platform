import { getUncachableStripeClient } from '../artifacts/api-server/src/stripeClient';

const PLANS = [
  {
    name: 'Dynasties Starter',
    description: 'For small forwarders getting started with digital operations',
    metadata: {
      planType: 'STARTER',
      features: JSON.stringify([
        '3 team members',
        '40 shipments/month',
        'Basic document generation',
        'Email support',
      ]),
    },
    monthlyPrice: 24900,
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
    monthlyPrice: 89500,
  },
  {
    name: 'Dynasties Scale',
    description: 'For established forwarders with high-volume operations',
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
    monthlyPrice: 240000,
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
    monthlyPrice: 0,
  },
];

const DEPLOYMENT_FEES = [
  {
    name: 'Growth Deployment Fee',
    description: 'One-time deployment and onboarding fee for Growth plan',
    metadata: { planType: 'GROWTH', priceType: 'deployment_fee' },
    price: 150000,
  },
  {
    name: 'Scale Deployment Fee',
    description: 'One-time deployment and onboarding fee for Scale plan',
    metadata: { planType: 'SCALE', priceType: 'deployment_fee' },
    price: 350000,
  },
  {
    name: 'Enterprise Deployment Fee',
    description: 'Custom deployment and onboarding fee for Enterprise plan (placeholder)',
    metadata: { planType: 'ENTERPRISE', priceType: 'deployment_fee' },
    price: 0,
  },
];

async function seedProducts() {
  const stripe = await getUncachableStripeClient();
  console.log('Seeding Stripe products with correct Dynasties pricing...\n');

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

    if (plan.monthlyPrice > 0) {
      const monthly = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthlyPrice,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { planType: plan.metadata.planType, interval: 'month', priceType: 'subscription' },
      });
      console.log(`  monthly: $${(plan.monthlyPrice / 100).toFixed(2)}/mo (${monthly.id})`);
    } else {
      console.log(`  [custom pricing — no auto-created price]`);
    }
  }

  console.log('\n--- Deployment Fees ---\n');

  for (const fee of DEPLOYMENT_FEES) {
    if (fee.price === 0) {
      console.log(`[skip] ${fee.name} — custom/manual pricing`);
      continue;
    }

    const existing = await stripe.products.search({
      query: `name:'${fee.name}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(`[skip] ${fee.name} already exists (${existing.data[0].id})`);
      continue;
    }

    const product = await stripe.products.create({
      name: fee.name,
      description: fee.description,
      metadata: fee.metadata,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: fee.price,
      currency: 'usd',
      metadata: { planType: fee.metadata.planType, priceType: 'deployment_fee' },
    });

    console.log(`[created] ${fee.name} (${product.id})`);
    console.log(`  one-time: $${(fee.price / 100).toFixed(2)} (${price.id})`);
  }

  console.log('\nDone! Webhooks will sync products to the database.');
}

seedProducts().catch((err) => {
  console.error('Error seeding products:', err);
  process.exit(1);
});
