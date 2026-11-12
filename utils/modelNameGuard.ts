/**
 * Guard for the Model field on quotation / sale order / invoice / delivery order lines.
 *
 * The catalog pickers copy the pricelist's short Model and its Description into the two separate
 * fields. A whole product title typed or pasted into Model (INV2026-00043) leaves Description
 * empty on the form, prints the entire spec in bold on the PDF, and then rides along into every
 * document made from that line (SO → invoice → delivery order → serial record).
 */
export const MODEL_NAME_MAX_LENGTH = 80;

/** True when Model is long enough to be a pasted spec and Description has nothing in it. */
export const isModelNameTooLong = (modelName?: string | null, description?: string | null): boolean =>
    (modelName ?? '').trim().length > MODEL_NAME_MAX_LENGTH && !(description ?? '').trim();
