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
}
