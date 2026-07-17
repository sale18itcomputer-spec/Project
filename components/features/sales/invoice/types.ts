export interface BuildComponent {
    itemCode: string;
    modelName: string;
    brand?: string;
    qty: number;
    unitCost: number;
    serialNumber?: string;
    warrantyMonths?: number;
}

export interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName: string;
    description: string;
    qty: number | string;
    unitPrice: number | string;
    amount: number;
    brand?: string;
    serialNumber?: string;
    serialNumbers?: string[];
    isPromotion?: boolean;
    isPCBuild?: boolean;
    buildComponents?: BuildComponent[];
    /** Cost charged by an outsourced vendor for this service line (e.g. we
     *  charge the customer $35, the vendor charges us $25) — posts as COGS
     *  against Accounts Payable. Service invoices only. */
    vendorCost?: number | string;
}
