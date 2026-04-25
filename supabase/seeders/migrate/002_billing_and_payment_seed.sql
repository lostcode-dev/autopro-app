-- =============================================================================
-- Seeder: 002_billing_and_payment_seed.sql
-- Description: Migrates subscriptions, billing invoices, and payment terminals
--              from Base44 exports into the billing tables after the base
--              identity seed has already been applied.
-- =============================================================================

DO $$
DECLARE
  v_namespace uuid := '0f0f8ef0-8db5-4d52-a4ec-9cfdd0b451b1';
BEGIN
  CREATE TEMP TABLE tmp_user_profile_lookup (
    email varchar(200) PRIMARY KEY,
    organization_id uuid NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_user_profile_lookup (
    email,
    organization_id
  )
  SELECT DISTINCT ON (lower(user_profiles.email))
    lower(user_profiles.email),
    user_profiles.organization_id
  FROM public.user_profiles AS user_profiles
  WHERE user_profiles.email IS NOT NULL
    AND user_profiles.organization_id IS NOT NULL;

  CREATE TEMP TABLE tmp_subscription_source (
    legacy_subscription_id text PRIMARY KEY,
    user_email varchar(200),
    stripe_customer_id varchar(100),
    stripe_subscription_id varchar(100),
    plan_name varchar(100),
    legacy_status varchar(30),
    monthly_amount numeric(15, 2),
    start_date timestamptz,
    next_payment_date timestamptz,
    cancellation_date timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    created_by varchar(200)
  ) ON COMMIT DROP;

  INSERT INTO tmp_subscription_source VALUES
    ('690cd0b65dac433f6e3903e7', 'santarem279@gmail.com', 'cus_TNGpUtjyKMFT8g', 'sub_1SQWJYJ380mxz1y53Qxrc39w', 'AutoPro Beenk', 'ativa', 399.90, '2025-11-06T16:45:36.000Z'::timestamptz, '2025-12-06T16:45:36.000Z'::timestamptz, NULL, '2025-11-06T16:45:42.090000Z'::timestamptz, '2025-11-06T16:45:42.090000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('690a731520f7f054ff19acdf', 'contato@loker.com.br', 'cus_TMbAdRlrE2yGst', 'sub_1SPrywJ380mxz1y5YT0n8w3N', 'AutoPro Beenk', 'ativa', 399.90, '2025-11-04T21:41:38.000Z'::timestamptz, '2025-12-04T21:41:38.000Z'::timestamptz, NULL, '2025-11-04T21:41:41.590000Z'::timestamptz, '2026-02-16T12:50:00.213000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('690a6a34dd21e3e50c019338', 'marquesmd9@gmail.com', 'cus_TMaS2wN0on4R2c', 'sub_1SPrODJ380mxz1y5h1V2omP2', 'AutoPro Beenk', 'ativa', 399.90, '2025-11-04T21:03:41.000Z'::timestamptz, '2025-12-04T21:03:41.000Z'::timestamptz, NULL, '2025-11-04T21:03:48.605000Z'::timestamptz, '2026-02-16T12:49:54.234000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('690392842c8e1612ab06edb9', 'marquesmd9@gmail.com', 'cus_TKe1Bt68V0NT51', 'sub_1SNyjSJ380mxz1y53b6Jtzlm', 'AutoPro Beenk', 'ativa', 399.90, '2025-10-30T16:29:50.000Z'::timestamptz, '2025-11-30T16:29:50.000Z'::timestamptz, NULL, '2025-10-30T16:29:56.968000Z'::timestamptz, '2026-02-16T12:49:54.213000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com');

  INSERT INTO public.subscriptions (
    id,
    organization_id,
    user_email,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    plan_name,
    monthly_amount,
    start_date,
    next_payment_date,
    cancellation_date,
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at,
    deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'subscription:' || src.legacy_subscription_id),
    profile_lookup.organization_id,
    lower(src.user_email),
    CASE lower(src.legacy_status)
      WHEN 'ativa' THEN 'active'
      WHEN 'active' THEN 'active'
      WHEN 'cancelada' THEN 'cancelled'
      WHEN 'cancelled' THEN 'cancelled'
      WHEN 'suspensa' THEN 'suspended'
      WHEN 'suspended' THEN 'suspended'
      WHEN 'trial' THEN 'trial'
      WHEN 'teste' THEN 'trial'
      ELSE 'active'
    END,
    NULLIF(src.stripe_customer_id, ''),
    NULLIF(src.stripe_subscription_id, ''),
    src.plan_name,
    src.monthly_amount,
    src.start_date,
    src.next_payment_date,
    src.cancellation_date,
    src.created_at,
    src.created_by,
    src.updated_at,
    src.created_by,
    NULL,
    NULL
  FROM tmp_subscription_source AS src
  JOIN tmp_user_profile_lookup AS profile_lookup
    ON profile_lookup.email = lower(src.user_email)
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    user_email = EXCLUDED.user_email,
    status = EXCLUDED.status,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    plan_name = EXCLUDED.plan_name,
    monthly_amount = EXCLUDED.monthly_amount,
    start_date = EXCLUDED.start_date,
    next_payment_date = EXCLUDED.next_payment_date,
    cancellation_date = EXCLUDED.cancellation_date,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  CREATE TEMP TABLE tmp_billing_invoice_source (
    legacy_invoice_id text PRIMARY KEY,
    user_email varchar(200),
    legacy_subscription_id text,
    stripe_invoice_id varchar(100),
    stripe_subscription_id varchar(100),
    invoice_number varchar(50),
    amount numeric(15, 2),
    legacy_status varchar(30),
    issue_date timestamptz,
    due_date timestamptz,
    payment_date timestamptz,
    pdf_url varchar(500),
    description text,
    created_at timestamptz,
    updated_at timestamptz,
    created_by varchar(200)
  ) ON COMMIT DROP;

  INSERT INTO tmp_billing_invoice_source VALUES
    ('695d4b3edccbd2775c9a8f20', 'santarem279@gmail.com', '690cd0b65dac433f6e3903e7', 'in_1SmdOmJ380mxz1y5gTcXAbeV', NULL, '8EFI7NF9-0003', 0.00, 'paga', '2026-01-06T16:46:24.000Z'::timestamptz, '2026-01-06T16:46:24.000Z'::timestamptz, '2026-01-06T17:49:45.000Z'::timestamptz, 'https://pay.stripe.com/invoice/acct_1SNvHRJ380mxz1y5/live_YWNjdF8xU052SFJKMzgwbXh6MXk1LF9UazdlbFZCandoSzh2Wlh5b3I3T0VDT3VMNUM5RFRCLDE1ODI2MjU4Nw02001kjG655a/pdf?s=ap', 'Assinatura AutoPro Beenk', '2026-01-06T17:49:50.076000Z'::timestamptz, '2026-01-06T17:49:50.076000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('695aedb6b65d06db1418341f', 'contato@loker.com.br', '690a731520f7f054ff19acdf', 'in_1Slz3vJ380mxz1y5KosbOPAr', NULL, 'UMTOVARN-0003', 0.00, 'paga', '2026-01-04T21:42:11.000Z'::timestamptz, '2026-01-04T21:42:11.000Z'::timestamptz, '2026-01-04T22:46:09.000Z'::timestamptz, 'https://pay.stripe.com/invoice/acct_1SNvHRJ380mxz1y5/live_YWNjdF8xU052SFJKMzgwbXh6MXk1LF9UalJ4N01NQnRFcE5pRzZydGRGOHJvWU1Hc0VzNldNLDE1ODEwNzU3MQ02003ngHkuwp/pdf?s=ap', 'Assinatura AutoPro Beenk', '2026-01-04T22:46:14.772000Z'::timestamptz, '2026-02-16T14:20:43.803000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('695ae48c4c4755e8e8dfbb28', 'marquesmd9@gmail.com', '690a6a34dd21e3e50c019338', 'in_1SlyTEJ380mxz1y5sLvxRvAP', NULL, 'LZ2LHQMA-0003', 399.90, 'paga', '2026-01-04T21:04:16.000Z'::timestamptz, '2026-01-04T21:04:16.000Z'::timestamptz, '2026-01-04T22:07:00.000Z'::timestamptz, 'https://pay.stripe.com/invoice/acct_1SNvHRJ380mxz1y5/live_YWNjdF8xU052SFJKMzgwbXh6MXk1LF9UalJMR1NoSmFCdndXOVhBZGF2N0xUMEpPeEczRlZOLDE1ODEwNTIyNQ02001iOdrwCY/pdf?s=ap', 'Assinatura AutoPro Beenk', '2026-01-04T22:07:08.094000Z'::timestamptz, '2026-02-16T14:20:33.234000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('69540cb8b4cefb53a5c67c3d', 'contato@loker.com.br', '690a731520f7f054ff19acdf', 'in_1Sk5oBJ380mxz1y5HKqqvkII', NULL, 'UEEXJEW9-0003', 0.00, 'paga', '2025-12-30T16:30:07.000Z'::timestamptz, '2025-12-30T16:30:07.000Z'::timestamptz, '2025-12-30T17:32:36.000Z'::timestamptz, 'https://pay.stripe.com/invoice/acct_1SNvHRJ380mxz1y5/live_YWNjdF8xU052SFJKMzgwbXh6MXk1LF9UaFVuWFU5aUtSQU1IMHZFcXpPcm9JT1pHYnc0WWlnLDE1NzY1Njc1OA0200uADPhiNo/pdf?s=ap', 'Assinatura AutoPro Beenk', '2025-12-30T17:32:40.948000Z'::timestamptz, '2026-02-16T14:20:43.890000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('69346c10e1e7759334dc5f7a', 'santarem279@gmail.com', '690cd0b65dac433f6e3903e7', 'in_1SbOcqJ380mxz1y5P2Ft4T8R', NULL, '8EFI7NF9-0002', 0.00, 'paga', '2025-12-06T16:46:28.000Z'::timestamptz, '2025-12-06T16:46:28.000Z'::timestamptz, '2025-12-06T17:46:52.000Z'::timestamptz, 'https://pay.stripe.com/invoice/acct_1SNvHRJ380mxz1y5/live_YWNjdF8xU052SFJKMzgwbXh6MXk1LF9UWVZlSVFVQXV0cmlrQ0lPcG9IeEF2c3k3NGtwbWIwLDE1NTU4NDAxMw0200rTOPgXhv/pdf?s=ap', 'Assinatura AutoPro Beenk', '2025-12-06T17:46:56.071000Z'::timestamptz, '2025-12-06T17:46:56.071000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('69320e91b2e30bdf1b291576', 'contato@loker.com.br', '690a731520f7f054ff19acdf', 'in_1SakICJ380mxz1y5Bdo0T8SH', NULL, 'UMTOVARN-0002', 0.00, 'paga', '2025-12-04T21:42:28.000Z'::timestamptz, '2025-12-04T21:42:28.000Z'::timestamptz, '2025-12-04T22:43:25.000Z'::timestamptz, 'https://pay.stripe.com/invoice/acct_1SNvHRJ380mxz1y5/live_YWNjdF8xU052SFJKMzgwbXh6MXk1LF9UWHB5TDBTVEd5SHlPbm9SUHU5MFo2dzR6bWlaaDZLLDE1NTQyOTAwNw02006oq40EPJ/pdf?s=ap', 'Assinatura AutoPro Beenk', '2025-12-04T22:43:29.415000Z'::timestamptz, '2026-02-16T14:20:43.912000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('6932059f131ba3f0be95d5bb', 'marquesmd9@gmail.com', '690392842c8e1612ab06edb9', 'in_1SajhBJ380mxz1y5XmtvcC9q', NULL, 'LZ2LHQMA-0002', 399.90, 'paga', '2025-12-04T21:04:13.000Z'::timestamptz, '2025-12-04T21:04:13.000Z'::timestamptz, '2025-12-04T22:05:12.000Z'::timestamptz, 'https://pay.stripe.com/invoice/acct_1SNvHRJ380mxz1y5/live_YWNjdF8xU052SFJKMzgwbXh6MXk1LF9UWHBMY3oxS0FkWWZxTGJrRHlPWEZBajlKTzYxUXJ6LDE1NTQyNjcxNg0200u0IGtHBQ/pdf?s=ap', 'Assinatura AutoPro Beenk', '2025-12-04T22:05:19.156000Z'::timestamptz, '2026-02-16T14:20:33.162000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('692c7f54f13c2be270574d8f', 'contato@loker.com.br', '690a731520f7f054ff19acdf', 'in_1SZDVnJ380mxz1y5V882o5wU', NULL, 'UEEXJEW9-0002', 0.00, 'paga', '2025-11-30T16:30:11.000Z'::timestamptz, '2025-11-30T16:30:11.000Z'::timestamptz, '2025-11-30T17:30:55.000Z'::timestamptz, 'https://pay.stripe.com/invoice/acct_1SNvHRJ380mxz1y5/live_YWNjdF8xU052SFJKMzgwbXh6MXk1LF9UV0cxbnJicTlUVUY4NGZOaHdxbE5QaU1BYTJ3c3BOLDE1NTA2NDY1Nw0200iXBxu7Bj/pdf?s=ap', 'Assinatura AutoPro Beenk', '2025-11-30T17:31:00.059000Z'::timestamptz, '2026-02-16T14:20:43.874000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('690cd0b624f28cf5cc9b9711', 'santarem279@gmail.com', NULL, 'in_1SQWJYJ380mxz1y5fwt3vFvG', NULL, '8EFI7NF9-0001', 0.00, 'paga', '2025-11-06T16:45:36.000Z'::timestamptz, '2025-11-06T16:45:36.000Z'::timestamptz, '2025-11-06T16:45:36.000Z'::timestamptz, 'https://pay.stripe.com/invoice/acct_1SNvHRJ380mxz1y5/live_YWNjdF8xU052SFJKMzgwbXh6MXk1LF9UTkdyNzJDV1VSTkxoU3h3OG1DQmJ4OUhDNXdMVXNFLDE1Mjk4ODMzOQ0200BAVDjzoO/pdf?s=ap', 'Assinatura AutoPro Beenk', '2025-11-06T16:45:42.010000Z'::timestamptz, '2025-11-06T16:45:42.010000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('690a7316d540a0a2f29add1b', 'contato@loker.com.br', '690a731520f7f054ff19acdf', 'in_1SPrywJ380mxz1y5fYI1zdee', NULL, 'UMTOVARN-0001', 0.00, 'paga', '2025-11-04T21:41:38.000Z'::timestamptz, '2025-11-04T21:41:38.000Z'::timestamptz, '2025-11-04T21:41:38.000Z'::timestamptz, 'https://pay.stripe.com/invoice/acct_1SNvHRJ380mxz1y5/live_YWNjdF8xU052SFJKMzgwbXh6MXk1LF9UTWJCamVjMkI1VXJucjZXM0wwOHNKdUJoTlJGQVhaLDE1MjgzMzMwMA0200oDjFqPpd/pdf?s=ap', 'Assinatura AutoPro Beenk', '2025-11-04T21:41:42.321000Z'::timestamptz, '2026-02-16T14:20:43.849000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com'),
    ('690a6a3509e2d25afe6cfecc', 'marquesmd9@gmail.com', '690392842c8e1612ab06edb9', 'in_1SPrODJ380mxz1y51qJ6xzvM', NULL, 'LZ2LHQMA-0001', 399.90, 'paga', '2025-11-04T21:03:41.000Z'::timestamptz, '2025-11-04T21:03:41.000Z'::timestamptz, '2025-11-04T21:03:44.000Z'::timestamptz, 'https://pay.stripe.com/invoice/acct_1SNvHRJ380mxz1y5/live_YWNjdF8xU052SFJKMzgwbXh6MXk1LF9UTWFaUUI5bDFUc1dZSXpwUEtSdjhkWlNGWDhLM0ZqLDE1MjgzMTAyNg0200WcBKPwUT/pdf?s=ap', 'Assinatura AutoPro Beenk', '2025-11-04T21:03:49.006000Z'::timestamptz, '2026-02-16T14:20:33.125000Z'::timestamptz, 'service+cc865314-18f7-402e-b534-8a8dc7f7e16b@no-reply.base44.com');

  INSERT INTO public.billing_invoices (
    id,
    organization_id,
    user_email,
    stripe_invoice_id,
    amount,
    status,
    subscription_id,
    stripe_subscription_id,
    invoice_number,
    issue_date,
    due_date,
    payment_date,
    pdf_url,
    description,
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at,
    deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'billing_invoice:' || src.legacy_invoice_id),
    profile_lookup.organization_id,
    lower(src.user_email),
    src.stripe_invoice_id,
    src.amount,
    CASE lower(src.legacy_status)
      WHEN 'paga' THEN 'paid'
      WHEN 'paid' THEN 'paid'
      WHEN 'pendente' THEN 'pending'
      WHEN 'pending' THEN 'pending'
      WHEN 'falha' THEN 'failed'
      WHEN 'failed' THEN 'failed'
      WHEN 'cancelada' THEN 'cancelled'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE 'pending'
    END,
    CASE
      WHEN src.legacy_subscription_id IS NULL OR src.legacy_subscription_id = '' THEN NULL
      ELSE uuid_generate_v5(v_namespace, 'subscription:' || src.legacy_subscription_id)
    END,
    NULLIF(src.stripe_subscription_id, ''),
    NULLIF(src.invoice_number, ''),
    src.issue_date,
    src.due_date,
    src.payment_date,
    src.pdf_url,
    src.description,
    src.created_at,
    src.created_by,
    src.updated_at,
    src.created_by,
    NULL,
    NULL
  FROM tmp_billing_invoice_source AS src
  JOIN tmp_user_profile_lookup AS profile_lookup
    ON profile_lookup.email = lower(src.user_email)
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    user_email = EXCLUDED.user_email,
    stripe_invoice_id = EXCLUDED.stripe_invoice_id,
    amount = EXCLUDED.amount,
    status = EXCLUDED.status,
    subscription_id = EXCLUDED.subscription_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    invoice_number = EXCLUDED.invoice_number,
    issue_date = EXCLUDED.issue_date,
    due_date = EXCLUDED.due_date,
    payment_date = EXCLUDED.payment_date,
    pdf_url = EXCLUDED.pdf_url,
    description = EXCLUDED.description,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  CREATE TEMP TABLE tmp_payment_terminal_source (
    legacy_terminal_id text PRIMARY KEY,
    legacy_bank_account_id text,
    terminal_name varchar(100),
    provider_company varchar(100),
    payment_receipt_days int,
    is_active boolean,
    rates jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    created_by varchar(200)
  ) ON COMMIT DROP;

  INSERT INTO tmp_payment_terminal_source VALUES
    (
      '68bc89becc2c2e048d5d5c50',
      '68bb882e3e048c2ca6bd6d76',
      'Plus',
      'QuotaBank',
      1,
      true,
      '[{"numero_parcela":1,"taxa_percentual":1.99},{"numero_parcela":2,"taxa_percentual":2.99},{"numero_parcela":3,"taxa_percentual":3.99},{"numero_parcela":4,"taxa_percentual":4.99},{"numero_parcela":5,"taxa_percentual":5.99},{"numero_parcela":6,"taxa_percentual":6.99},{"numero_parcela":7,"taxa_percentual":7.99},{"numero_parcela":8,"taxa_percentual":8.99},{"numero_parcela":9,"taxa_percentual":9.99},{"numero_parcela":10,"taxa_percentual":10.99},{"numero_parcela":11,"taxa_percentual":11.99},{"numero_parcela":12,"taxa_percentual":12.99},{"numero_parcela":13,"taxa_percentual":13.99},{"numero_parcela":14,"taxa_percentual":14.99},{"numero_parcela":15,"taxa_percentual":15.99},{"numero_parcela":16,"taxa_percentual":16.99},{"numero_parcela":17,"taxa_percentual":17.99},{"numero_parcela":18,"taxa_percentual":18.99}]'::jsonb,
      '2025-09-06T19:21:34.902000Z'::timestamptz,
      '2025-09-09T17:34:39.245000Z'::timestamptz,
      'beenkoficial@gmail.com'
    );

  INSERT INTO public.payment_terminals (
    id,
    organization_id,
    terminal_name,
    provider_company,
    bank_account_id,
    payment_receipt_days,
    is_active,
    rates,
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at,
    deleted_by
  )
  SELECT
    uuid_generate_v5(v_namespace, 'payment_terminal:' || src.legacy_terminal_id),
    bank_accounts.organization_id,
    src.terminal_name,
    src.provider_company,
    bank_accounts.id,
    src.payment_receipt_days,
    src.is_active,
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'installment_number', (entry ->> 'numero_parcela')::int,
            'rate_percentage', (entry ->> 'taxa_percentual')::numeric
          )
          ORDER BY (entry ->> 'numero_parcela')::int
        ),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(COALESCE(src.rates, '[]'::jsonb)) AS entry
    ),
    src.created_at,
    src.created_by,
    src.updated_at,
    src.created_by,
    NULL,
    NULL
  FROM tmp_payment_terminal_source AS src
  JOIN public.bank_accounts AS bank_accounts
    ON bank_accounts.id = uuid_generate_v5(v_namespace, 'bank_account:' || src.legacy_bank_account_id)
  ON CONFLICT (id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    terminal_name = EXCLUDED.terminal_name,
    provider_company = EXCLUDED.provider_company,
    bank_account_id = EXCLUDED.bank_account_id,
    payment_receipt_days = EXCLUDED.payment_receipt_days,
    is_active = EXCLUDED.is_active,
    rates = EXCLUDED.rates,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL,
    deleted_by = NULL;

  RAISE NOTICE 'Skipped % subscriptions without a matching migrated user profile.', (
    SELECT count(*)
    FROM tmp_subscription_source AS src
    LEFT JOIN tmp_user_profile_lookup AS profile_lookup
      ON profile_lookup.email = lower(src.user_email)
    WHERE profile_lookup.organization_id IS NULL
  );

  RAISE NOTICE 'Skipped % invoices without a matching migrated user profile.', (
    SELECT count(*)
    FROM tmp_billing_invoice_source AS src
    LEFT JOIN tmp_user_profile_lookup AS profile_lookup
      ON profile_lookup.email = lower(src.user_email)
    WHERE profile_lookup.organization_id IS NULL
  );

  RAISE NOTICE 'Skipped % payment terminals without resolvable bank account mapping.', (
    SELECT count(*)
    FROM tmp_payment_terminal_source AS src
    LEFT JOIN public.bank_accounts AS bank_accounts
      ON bank_accounts.id = uuid_generate_v5(v_namespace, 'bank_account:' || src.legacy_bank_account_id)
    WHERE bank_accounts.id IS NULL
  );

  RAISE NOTICE 'Billing migration seed applied: subscriptions, invoices, and payment terminals.';
END;
$$;