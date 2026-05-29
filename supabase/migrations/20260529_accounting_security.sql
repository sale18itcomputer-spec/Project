-- ─── Accounting Security & Integration (Phase 1) ──────────────────────────────
-- 1. Audit columns on journal_entries (source, posted_by, posted_at)
-- 2. brand_account_mapping table for COA lookups
-- 3. Split RLS: per-operation policies replacing broad "FOR ALL"
-- 4. DELETE guard: posted entries cannot be deleted at DB level
-- 5. BEFORE UPDATE trigger: enforce DR=CR when posting

-- ── 1. Audit & source columns ─────────────────────────────────────────────────

ALTER TABLE journal_entries
    ADD COLUMN IF NOT EXISTS source     TEXT NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS posted_by  TEXT,
    ADD COLUMN IF NOT EXISTS posted_at  TIMESTAMPTZ;

-- source values: 'manual' | 'invoice' | 'receipt' | 'delivery_order' | 'purchase_order'
CREATE INDEX IF NOT EXISTS idx_je_source ON journal_entries(source);

-- ── 2. Brand → Chart of Accounts mapping ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_account_mapping (
    brand              TEXT PRIMARY KEY,
    revenue_account    TEXT NOT NULL REFERENCES chart_of_accounts(account_number),
    cogs_account       TEXT NOT NULL REFERENCES chart_of_accounts(account_number),
    inventory_account  TEXT NOT NULL REFERENCES chart_of_accounts(account_number)
);

ALTER TABLE brand_account_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bam_select" ON brand_account_mapping
    FOR SELECT USING (auth.role() = 'authenticated');

INSERT INTO brand_account_mapping (brand, revenue_account, cogs_account, inventory_account) VALUES
    ('ASUS',                  '40100', '50100', '12100'),
    ('DELL',                  '40200', '50200', '12200'),
    ('MSI',                   '40300', '50300', '12300'),
    ('Asus Acc. & PW Supply', '40400', '50400', '12400'),
    ('MSI Acc. & PW Supply',  '40500', '50500', '12500'),
    ('Other Accessories',     '40600', '50600', '12600'),
    ('Lenovo',                '40700', '50700', '12700'),
    ('Lenovo Accessories',    '40800', '50800', '12800')
ON CONFLICT (brand) DO NOTHING;

-- ── 3. Split RLS: journal_entries ─────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can manage journal_entries" ON journal_entries;

-- Any authenticated user can read journal entries
CREATE POLICY "je_select" ON journal_entries
    FOR SELECT USING (auth.role() = 'authenticated');

-- Any authenticated user can create new entries
CREATE POLICY "je_insert" ON journal_entries
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Any authenticated user can update (posting rules enforced by trigger)
CREATE POLICY "je_update" ON journal_entries
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Only UNPOSTED entries may be deleted — posted entries are permanent records
CREATE POLICY "je_delete" ON journal_entries
    FOR DELETE USING (auth.role() = 'authenticated' AND NOT is_posted);

-- ── 4. Split RLS: journal_entry_lines ─────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can manage journal_entry_lines" ON journal_entry_lines;

CREATE POLICY "jel_select" ON journal_entry_lines
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "jel_insert" ON journal_entry_lines
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "jel_update" ON journal_entry_lines
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Lines belonging to posted entries cannot be deleted directly
CREATE POLICY "jel_delete" ON journal_entry_lines
    FOR DELETE USING (
        auth.role() = 'authenticated' AND
        NOT EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_entry_id AND je.is_posted
        )
    );

-- ── 5. Balance-check trigger (fires when is_posted: false → true) ──────────────

CREATE OR REPLACE FUNCTION check_balance_before_post()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_debit  DECIMAL(15,2);
    v_credit DECIMAL(15,2);
    v_count  INTEGER;
BEGIN
    -- Only act when transitioning from unposted → posted
    IF NEW.is_posted AND NOT OLD.is_posted THEN
        SELECT
            COALESCE(SUM(debit),  0),
            COALESCE(SUM(credit), 0),
            COUNT(*)
        INTO v_debit, v_credit, v_count
        FROM journal_entry_lines
        WHERE journal_entry_id = NEW.id;

        IF v_count = 0 THEN
            RAISE EXCEPTION
                'Cannot post journal entry %: no lines found',
                NEW.entry_number;
        END IF;

        IF ABS(v_debit - v_credit) > 0.01 THEN
            RAISE EXCEPTION
                'Cannot post journal entry %: debits (%) ≠ credits (%)',
                NEW.entry_number, v_debit, v_credit;
        END IF;

        -- Stamp the post timestamp (posted_by is set by the application)
        NEW.posted_at := NOW();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_balance_before_post ON journal_entries;
CREATE TRIGGER trg_check_balance_before_post
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE PROCEDURE check_balance_before_post();
