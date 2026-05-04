-- Idempotent: normalize the demo tenant's billing legal-entity name to match the
-- canonical company name. The money-path test fixture overwrites this field
-- with a different string, which causes UI inconsistency. Running this script
-- after tests restores a single source of truth.
--
-- Safe to re-run.

UPDATE billing_accounts ba
SET legal_entity_name = c.name
FROM companies c
WHERE ba.company_id = c.id
  AND ba.legal_entity_name IS DISTINCT FROM c.name
  AND c.id = 'cmp_lorian_001';

-- Mirror the demo accounting-connection display name, if a row exists.
UPDATE accounting_connections ac
SET company_name = c.name
FROM companies c
WHERE ac.company_id = c.id
  AND c.id = 'cmp_lorian_001'
  AND (ac.company_name IS NULL OR ac.company_name <> c.name);
