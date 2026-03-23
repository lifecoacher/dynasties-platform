-- RLS Foundation: Enable Row-Level Security on critical multi-tenant tables
-- This provides a defense-in-depth layer alongside application-level companyId filtering.
-- Application connections should SET app.current_company_id = '<companyId>' per request.

-- Critical money-path tables
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_results ENABLE ROW LEVEL SECURITY;

-- Core data tables
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_documents_generated ENABLE ROW LEVEL SECURITY;

-- Billing & accounting
ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_sync_mappings ENABLE ROW LEVEL SECURITY;

-- Quotes & rate tables
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_tables ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies for each table
-- Pattern: allow access only when app.current_company_id matches the row's company_id
-- The superuser/migration role bypasses RLS by default.

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'invoices', 'shipment_charges', 'receivables',
    'carrier_invoices', 'reconciliation_results',
    'shipments', 'exceptions', 'entities', 'events', 'shipment_documents_generated',
    'billing_accounts', 'customer_billing_profiles',
    'accounting_connections', 'accounting_sync_mappings',
    'quotes', 'rate_tables'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format(
      'CREATE POLICY tenant_isolation_%I ON %I
       FOR ALL
       USING (company_id = current_setting(''app.current_company_id'', true))
       WITH CHECK (company_id = current_setting(''app.current_company_id'', true))',
      tbl, tbl
    );
  END LOOP;
END
$$;
