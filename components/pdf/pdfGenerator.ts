export interface PDFLayoutConfig {
    header: {
        logo: { x: number; y: number; width: number };
        companyName: { x: number; y: number; fontSize: number };
        contactInfo: { x: number; y: number; fontSize: number };
        address: { x: number; y: number; maxWidth: number; fontSize: number };
        separatorLine: { y: number; width: number };
    };
    title: {
        y: number;
        fontSize: number;
        underlineGap: number;
    };
    info: {
        startY: number;
        fontSize?: number;
        col1: { labelX: number; labelWidth: number; gap: number };
        col2: { labelX: number; labelWidth: number; gap: number };
        rowHeight: number;
    };
    table: {
        startY: number;
        margins: { left: number; right: number };
        columnWidths: {
            no: number;
            itemCode: number;
            qty: number;
            unitPrice: number;
            total: number;
        };
        fontSize: number;
        descriptionFontSize: number;
    };
    terms: {
        spacingBefore: number;
        titleFontSize: number;
        contentFontSize: number;
    };
    footer: {
        y: number;
        preparedBy: { x: number };
        middlePosition?: { x: number }; // For DO 'Delivered By'
        approvedBy: { x: number };
    };
}

export const defaultLayoutConfig: PDFLayoutConfig = {
    header: {
        logo: { x: 10, y: 5, width: 36 },
        companyName: { x: 55.3, y: 6.5, fontSize: 12 },
        contactInfo: { x: 55.3, y: 11, fontSize: 8 },
        address: { x: 55.3, y: 14.3, maxWidth: 155, fontSize: 8 },
        separatorLine: { y: 18.5, width: 0.1 },
    },
    title: {
        y: 26.5,
        fontSize: 12,
        underlineGap: 1.5,
    },
    info: {
        startY: 33.5,
        fontSize: 9,
        col1: { labelX: 11, labelWidth: 22, gap: 2 },
        col2: { labelX: 150, labelWidth: 22, gap: 2 },
        rowHeight: 8,
    },
    table: {
        startY: 73,
        margins: { left: 11, right: 11 },
        columnWidths: {
            no: 13,
            itemCode: 23,
            qty: 12,
            unitPrice: 18,
            total: 26,
        },
        fontSize: 9,
        descriptionFontSize: 8.5,
    },
    terms: {
        spacingBefore: 7,
        titleFontSize: 9,
        contentFontSize: 9,
    },
    footer: {
        y: 220, // Moved much higher to ensure all signature elements are visible
        preparedBy: { x: 50 },
        middlePosition: { x: 105 },
        approvedBy: { x: 160 },
    }
};
