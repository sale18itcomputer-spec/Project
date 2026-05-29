-- ─── Consignment Module ───────────────────────────────────────────────────────
-- Tracks supplier consignment stock displayed in the LPT showroom.
-- Not owned inventory — items are loaned by the supplier (e.g. ITC) for display.

CREATE TABLE IF NOT EXISTS consignments (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    voucher_no     TEXT UNIQUE NOT NULL,
    transfer_date  DATE NOT NULL,
    from_location  TEXT NOT NULL DEFAULT '',
    to_location    TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'Open',
    received_by    TEXT NOT NULL DEFAULT '',
    received_date  DATE,
    notes          TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consignments_date ON consignments(transfer_date DESC);

ALTER TABLE consignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage consignments"
    ON consignments FOR ALL USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION update_consignment_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_consignment_updated_at
    BEFORE UPDATE ON consignments FOR EACH ROW
    EXECUTE PROCEDURE update_consignment_updated_at();

CREATE TABLE IF NOT EXISTS consignment_items (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    consignment_id  UUID NOT NULL REFERENCES consignments(id) ON DELETE CASCADE,
    item_no         INT NOT NULL,
    item_code       TEXT NOT NULL,
    product_name    TEXT NOT NULL,
    brand           TEXT NOT NULL DEFAULT '',
    category        TEXT NOT NULL DEFAULT '',
    qty_sent        INT NOT NULL DEFAULT 0,
    qty_returned    INT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'Received',
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ci_consignment_id ON consignment_items(consignment_id);

ALTER TABLE consignment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage consignment_items"
    ON consignment_items FOR ALL USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION update_ci_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_ci_updated_at
    BEFORE UPDATE ON consignment_items FOR EACH ROW
    EXECUTE PROCEDURE update_ci_updated_at();

-- ── Seed: KHST0005867 (15 May 2026) ─────────────────────────────────────────

DO $$
DECLARE cid UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM consignments WHERE voucher_no = 'KHST0005867') THEN
        INSERT INTO consignments
            (voucher_no, transfer_date, from_location, to_location,
             status, received_by, received_date, notes)
        VALUES
            ('KHST0005867', '2026-05-15', 'WH: KH', 'TK (LPT Boeung Kak)',
             'Open', 'LPT Showroom', '2026-05-15',
             'All items received. GK100 US: MAC00026, GK110 US: MAC00027. Open — pending signature.')
        RETURNING id INTO cid;

        INSERT INTO consignment_items
            (consignment_id, item_no, item_code, product_name, brand, category, qty_sent, qty_returned, status)
        VALUES
            (cid,  1, 'LAC00020', 'Lenovo Essential Wireless Combo',              'Lenovo', 'Accessories', 2, 0, 'Received'),
            (cid,  2, 'LAC00046', 'Lenovo BO 100 Stereo USB Headset',             'Lenovo', 'Accessories', 2, 0, 'Received'),
            (cid,  3, 'LAC00021', 'Lenovo ThinkPad X1 Presenter Mouse',           'Lenovo', 'Accessories', 2, 0, 'Received'),
            (cid,  4, 'LAC00057', 'Lenovo Mouse 600 BT Silent',                   'Lenovo', 'Accessories', 2, 0, 'Received'),
            (cid,  5, 'LAC00058', 'Lenovo IdeaPad Gaming H100 Headset',           'Lenovo', 'Accessories', 2, 0, 'Received'),
            (cid,  6, 'LAC00060', 'Lenovo Go Multi WL Mouse',                     'Lenovo', 'Accessories', 2, 0, 'Received'),
            (cid,  7, 'LAC00029', 'Lenovo 300 FHD Webcam',                        'Lenovo', 'Accessories', 2, 0, 'Received'),
            (cid,  8, 'LAC00031', 'Lenovo Select Wireless Modern Combo',          'Lenovo', 'Accessories', 2, 0, 'Received'),
            (cid,  9, 'LPC00058', 'Lenovo ThinkVision S24i-30',                   'Lenovo', 'Monitor/PC',  1, 0, 'Received'),
            (cid, 10, 'SAC00358', 'ASUS P309 TUF GAMING M3 GEN II',               'ASUS',   'Accessories', 2, 0, 'Received'),
            (cid, 11, 'LPC00063', 'Lenovo ThinkCentre neo 50t Gen 5',             'Lenovo', 'Monitor/PC',  1, 0, 'Received'),
            (cid, 12, 'SNB01333', 'ASUS ROG Zephyrus GA403WM (Eclipse Gray)',     'ASUS',   'Laptop',      1, 0, 'Received'),
            (cid, 13, 'SAC00373', 'ASUS TUF Gaming K3 Gen II (Red Switch)',       'ASUS',   'Accessories', 2, 0, 'Received'),
            (cid, 14, 'SAC00374', 'ASUS TUF Gaming K3 Gen II (Blue Switch)',      'ASUS',   'Accessories', 2, 0, 'Received'),
            (cid, 15, 'SNB01341', 'ASUS TUF FX608JHR-RV038W (Jaeger Gray)',      'ASUS',   'Laptop',      1, 1, 'Transferred Back'),
            (cid, 16, 'MAC00026', 'MSI FORGE GK100 US',                            'MSI',    'Accessories', 6, 0, 'Received'),
            (cid, 17, 'MAC00027', 'MSI FORGE GK110 US',                            'MSI',    'Accessories', 7, 0, 'Received'),
            (cid, 18, 'SAC00397', 'ASUS 100W 3-Port GaN Charger',                 'ASUS',   'Accessories', 1, 0, 'Received'),
            (cid, 19, 'SAC00392', 'ASUS AC65-03 CHARGER DOCK (Black)',            'ASUS',   'Accessories', 1, 0, 'Received'),
            (cid, 20, 'SAC00398', 'ASUS 65W USB-C GaN Charger (White)',           'ASUS',   'Accessories', 1, 0, 'Received'),
            (cid, 21, 'SAC00399', 'ASUS Marshmallow Keyboard KW100 (Beige)',      'ASUS',   'Accessories', 2, 0, 'Received'),
            (cid, 22, 'SAC00400', 'ASUS Marshmallow Keyboard KW100 (Pink)',       'ASUS',   'Accessories', 2, 0, 'Received'),
            (cid, 23, 'SAC00395', 'ASUS Marshmallow Mouse MD100 (Blue)',          'ASUS',   'Accessories', 2, 0, 'Received'),
            (cid, 24, 'SAC00396', 'ASUS Marshmallow Mouse MD100 (Beige)',         'ASUS',   'Accessories', 2, 0, 'Received'),
            (cid, 25, 'SAC00393', 'ASUS SmartO Mouse MD200 Silent Plus (Beige)',  'ASUS',   'Accessories', 2, 0, 'Received'),
            (cid, 26, 'SAC00394', 'ASUS SmartO Mouse MD200 Silent Plus (Green)',  'ASUS',   'Accessories', 2, 0, 'Received'),
            (cid, 27, 'SAC00387', 'ASUS Marshmallow Mouse MD100 (Purple)',        'ASUS',   'Accessories', 2, 0, 'Received'),
            (cid, 28, 'SAC00388', 'ASUS Wireless Silent Mouse MW103 (Black)',     'ASUS',   'Accessories', 5, 0, 'Received'),
            (cid, 29, 'SNB01362', 'ASUS VivoBook V3607VJ-RP084W (Matte Black)',   'ASUS',   'Laptop',      1, 0, 'Received'),
            (cid, 30, 'MNB00201', 'MSI Modern 14 F13MG-638XKH (Urban Silver)',    'MSI',    'Laptop',      1, 0, 'Received'),
            (cid, 31, 'MNB00191', 'MSI Modern 14 F13MG-637XKH (Platinum Gray)',   'MSI',    'Laptop',      1, 0, 'Received'),
            (cid, 32, 'SNB01367', 'ASUS VivoBook S3407CA-LY071W (Matte Gray)',    'ASUS',   'Laptop',      1, 0, 'Received'),
            (cid, 33, 'LNB00043', 'Lenovo IdeaPad Slim 3 15IRH10',               'Lenovo', 'Laptop',      1, 0, 'Received'),
            (cid, 34, 'SNB01374', 'ASUS VivoBook E1404TA-EB045W (Mixed Black)',   'ASUS',   'Laptop',      1, 0, 'Received'),
            (cid, 35, 'SNB01388', 'ASUS ZenBook UX3405CA-SU901W (Ponder Blue)',   'ASUS',   'Laptop',      1, 0, 'Received'),
            (cid, 36, 'SNB01392', 'ASUS ROG Strix G614PH-RV114W (Volt Green)',    'ASUS',   'Laptop',      1, 0, 'Received'),
            (cid, 37, 'SNB01390', 'ASUS TUF FA506NCQ-HN026W (Graphite Black)',    'ASUS',   'Laptop',      1, 0, 'Received'),
            (cid, 38, 'MNB00221', 'MSI Cyborg 15 A13UC-2440KH (Black)',            'MSI',    'Laptop',      1, 0, 'Received'),
            (cid, 39, 'LNB00048', 'Lenovo IdeaPad Slim 5 16IMH10',               'Lenovo', 'Laptop',      1, 0, 'Received'),
            (cid, 40, 'LNB00050', 'Lenovo IdeaPad Slim 3 15ARP10',               'Lenovo', 'Laptop',      1, 0, 'Received'),
            (cid, 41, 'LNB00054', 'Lenovo Legion 5 15IRX10',                     'Lenovo', 'Laptop',      1, 0, 'Received'),
            (cid, 42, 'MNB00213', 'MSI Modern 15 F1MG-1073KH (Urban Silver)',     'MSI',    'Laptop',      1, 0, 'Received'),
            (cid, 43, 'MNB00219', 'MSI Raider 18 HX A2WH-1204KH',                'MSI',    'Laptop',      1, 0, 'Received'),
            (cid, 44, 'SPC00018', 'ASUS AIO V440VAK-BPC215W (Black)',             'ASUS',   'Monitor/PC',  1, 0, 'Received'),
            (cid, 45, 'SPC00016', 'ASUS AIO V470VAK-WPE486W (White)',             'ASUS',   'Monitor/PC',  1, 0, 'Received'),
            (cid, 46, 'LNB00057', 'Lenovo Yoga 7 2-in-1 16ILL10',                'Lenovo', 'Laptop',      1, 0, 'Received'),
            (cid, 47, 'MNB00231', 'MSI Cyborg 15 C2WE-004KH',                     'MSI',    'Laptop',      1, 0, 'Received');
    END IF;
END $$;
