/**
 * Regression checks for the deposit footer on VAT tax invoices (buildTaxInvoice.ts).
 *
 * Two separate incidents on the SAME PROXY SOLUTIONS invoice, both real, both
 * shipped to a customer before being caught — and the second one shipped
 * WHILE fixing the first, because the first fix only checked the number the
 * user had pointed at (the percent label) and never verified the sibling
 * dollar-amount calculations three lines below it, which used the same input
 * and were still wrong:
 *
 *   Bug #1 (percent label): depositPercent divided by the pre-VAT subtotal
 *   instead of the VAT-inclusive grand total, printing "22%" for a deposit
 *   that was actually 20% of the deal.
 *
 *   Bug #2 (dollar amounts): `deposit` (hd['Deposit'], $41,773.60) is the
 *   GROSS amount actually collected. The code treated it as NET and taxed it
 *   again on top, so the printed Deposit/VAT/Grand Total rows read
 *   $41,773.60 / $4,177.36 / $45,950.96 instead of the correct
 *   $37,976.00 / $3,797.60 / $41,773.60.
 *
 * Both figures are now produced by ONE function, computeVatDepositFooter,
 * with a hard internal reconciliation check (see its doc comment). This
 * script checks: the real numbers reproduce correctly, the exact wrong
 * numbers from both incidents never come back, and the call site in
 * buildTaxInvoice.ts still routes through that one function rather than
 * scattered local consts.
 *
 * Run: node scripts/regression-deposit-percent.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeVatDepositFooter } from '../lib/pdf/shared-pure.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '../lib/pdf/buildTaxInvoice.ts'), 'utf8');

// ── Real incident numbers ───────────────────────────────────────────────────
const proxyDeposit    = 41773.60; // gross, VAT-inclusive — what was actually collected
const proxyGrandTotal = 208868;   // full order grand total
const proxyRate       = 4025;

const footer = computeVatDepositFooter(proxyDeposit, proxyGrandTotal, proxyRate);

assert.equal(footer.depositPercent, 20, 'Bug #1: deposit must compute as 20% of the grand total, not 22%');
assert.equal(footer.depositNet, 37976.00, 'Bug #2: deposit must decompose to a net (pre-VAT) amount of $37,976.00');
assert.equal(footer.depositVat, 3797.60, 'Bug #2: deposit must decompose to a VAT amount of $3,797.60');
assert.equal(footer.grandUsd, 41773.60, 'Bug #2: the amount due now must equal exactly what was collected, not a re-taxed figure');
assert.equal(footer.grandRiel, 168138740, 'Riel grand total must be based on the correct (not double-taxed) USD figure');

// The exact wrong numbers that were printed on the real invoice — must never recur.
assert.notEqual(footer.depositPercent, 22, 'must not reproduce the pre-VAT-subtotal percent bug');
assert.notEqual(footer.depositVat, 4177.36, 'must not reproduce the double-taxed VAT amount');
assert.notEqual(footer.grandUsd, 45950.96, 'must not reproduce the double-taxed grand total');

// Internal consistency, general case (not just the one incident's numbers).
assert.equal(
    Math.round((footer.depositNet + footer.depositVat) * 100) / 100, proxyDeposit,
    'net + vat must always sum back to the original gross deposit exactly',
);

// Edge cases.
const zero = computeVatDepositFooter(0, proxyGrandTotal, proxyRate);
assert.equal(zero.depositNet, 0);
assert.equal(zero.depositVat, 0);
assert.equal(zero.grandUsd, 0);

// ── Call-site check — catch a future regression even if computeVatDepositFooter
//    itself stays correct but someone bypasses it with local consts again ────
assert.match(
    source, /computeVatDepositFooter\(\s*deposit\s*,\s*totals\.grandTotal\s*,\s*rateNum\s*\)/,
    'buildTaxInvoice.ts must route deposit-mode figures through computeVatDepositFooter(deposit, totals.grandTotal, rateNum) — ' +
    'reintroducing separate local consts for vatBase/vatAmount/grandUsd is exactly how both incidents happened',
);

console.log('Deposit footer regression checks passed: percent label AND dollar amounts both correct.');
