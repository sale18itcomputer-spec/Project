export interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName: string;
    description: string;
    qty: number | string;
    unitPrice: number | string;
    amount: number;
    serialNumber?: string;
    serialNumbers?: string[];
    isPromotion?: boolean;
}
