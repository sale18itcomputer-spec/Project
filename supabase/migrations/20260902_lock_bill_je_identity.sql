-- 20260902_lock_bill_je_identity.sql
--
-- PREVENTION: stop bill journal entries from being double-posted.
--
-- Root cause of the BILL-0021..0030 double-bookings (Sep 2026): the bill
-- posting/payment idempotency guards key on (source='bill', reference=bill_number).
-- Someone edited the *reference* of a bill's booking JE to the vendor's invoice
-- number (e.g. JE for BILL-0023 -> 'KH-26-08-SJ0000381'). That silently decoupled
-- the JE from its bill: on the next unpost -> repost, the guard searched for
-- reference='BILL-0023', found nothing, and created a SECOND booking JE. Eight
-- bills were double-booked this way.
--
-- The vendor invoice number already has a proper home on the bill
-- (bills.vendor_reference), and the payment voucher lives on bills.payment_reference,
-- so the JE reference never needs manual editing. Lock it.
--
-- This trigger makes `reference` and `source` IMMUTABLE for source='bill' journal
-- entries. All legitimate flows (post = insert, reconcile/unpost = is_posted toggle,
-- payment = new JE) never change these two columns, so nothing normal is affected.
--
-- Authorized data repairs may bypass for one transaction with:
--     SET app.allow_bill_je_edit = 'on';

CREATE OR REPLACE FUNCTION fn_lock_bill_je_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    -- One-transaction escape hatch for deliberate admin repairs.
    IF current_setting('app.allow_bill_je_edit', true) = 'on' THEN
        RETURN NEW;
    END IF;

    IF OLD.source = 'bill' THEN
        IF NEW.reference IS DISTINCT FROM OLD.reference THEN
            RAISE EXCEPTION
                'Journal entry % is a bill entry; its reference (%) is locked to the bill number and cannot be edited. Record vendor invoice / voucher numbers on the bill''s Vendor Ref or Payment Ref fields instead.',
                OLD.entry_number, OLD.reference;
        END IF;
        IF NEW.source IS DISTINCT FROM OLD.source THEN
            RAISE EXCEPTION
                'Journal entry % is a bill entry; its source cannot be changed.',
                OLD.entry_number;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_bill_je_identity ON journal_entries;
CREATE TRIGGER trg_lock_bill_je_identity
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION fn_lock_bill_je_identity();
