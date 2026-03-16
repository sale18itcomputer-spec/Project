import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
        lastAutoTable?: {
            finalY: number;
        };
    }
}

interface PDFHeaderData {
    [key: string]: any;
}

// Local Khmer OS font from the public directory
const KHMER_FONT_URL = '/KhmerOS.ttf';
let khmerFontBase64: string | null = null;
let isKhmerFontActive = false;

// Use 'R' for Riel symbol as requested
const RIEL_SYMBOL = 'R';

interface PDFItem {
    no: number | string;
    itemCode: string;
    description: string;
    modelName?: string;
    qty: number | string;
    unitPrice: number | string;
    amount: number | string;
    commission?: number | string;
}

interface PDFTotals {
    subTotal: number;
    tax?: number;
    vat?: number;
    grandTotal: number;
}

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

interface GeneratePDFOptions {
    title: string;
    headerData: PDFHeaderData;
    items: PDFItem[];
    totals: PDFTotals;
    currency: 'USD' | 'KHR';
    filename: string;
    type: 'Quotation' | 'Sale Order' | 'Invoice' | 'Delivery Order' | 'Purchase Order';
    layout?: PDFLayoutConfig;
    previewMode?: boolean;
}

const getCurrencySymbol = (currency?: 'USD' | 'KHR'): string => {
    switch (currency) {
        case 'USD': return '$';
        case 'KHR': return RIEL_SYMBOL;
        default: return '$';
    }
};

const formatCurrency = (value: number | string, currency: 'USD' | 'KHR') => {
    const symbol = getCurrencySymbol(currency);
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(numValue)) return `${symbol} 0.00`;
    return `${symbol} ${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString || '';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

async function loadKhmerFont(doc: jsPDF) {
    if (!khmerFontBase64) {
        try {
            console.log('PDF: Fetching Khmer OS System font...');
            const response = await fetch(KHMER_FONT_URL);
            if (!response.ok) throw new Error('Font download failed');
            const buffer = await response.arrayBuffer();

            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            khmerFontBase64 = btoa(binary);
            console.log('PDF: Khmer OS System font loaded.');
        } catch (error) {
            console.error('PDF: Khmer font fetch failed.', error);
            return false;
        }
    }

    if (khmerFontBase64) {
        try {
            doc.addFileToVFS('KhmerOS.ttf', khmerFontBase64);
            doc.addFont('KhmerOS.ttf', 'KhmerOS', 'normal');
            isKhmerFontActive = true;
            return true;
        } catch (e) {
            console.error('PDF: Error adding Khmer font to VFS.', e);
        }
    }
    return false;
}

const generatePurchaseOrderPDF = async (doc: jsPDF, options: GeneratePDFOptions, layout: PDFLayoutConfig, isKHR: boolean, primaryColor: number[], black: number[]): Promise<string | void> => {
    const { headerData, items, totals, currency, filename, previewMode } = options;

    // Title
    doc.setFontSize(14);
    if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'bold');
    else doc.setFont('times', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const titleText = "PURCHASE ORDER";
    const titleWidth = doc.getTextWidth(titleText);
    const titleX = (210 - titleWidth) / 2;
    doc.text(titleText, titleX, 20);

    // Block 1 Header
    let y = 30;
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(10, y, 190, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text("Vendor Name:", 12, y + 4);
    doc.text("Address:", 70, y + 4);
    doc.text("Order Date:", 130, y + 4);
    doc.text("PO Number # :", 165, y + 4);

    // Block 1 Data
    y += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'normal');
    else doc.setFont('times', 'normal');

    let currentVendorY = y;
    doc.text(headerData['Vendor Name'] || '', 12, currentVendorY);
    if (headerData['Vendor Contact']) {
        currentVendorY += 5;
        doc.text(headerData['Vendor Contact'] || '', 12, currentVendorY);
    }
    if (headerData['Vendor Phone']) {
        currentVendorY += 5;
        doc.text(headerData['Vendor Phone'] || '', 12, currentVendorY);
    }

    const vAddress = doc.splitTextToSize(headerData['Vendor Address'] || '', 55);
    doc.text(vAddress, 70, y);
    doc.text(formatDate(headerData['Order Date']), 130, y);
    doc.text(String(headerData['PO Number'] || ''), 165, y);

    let maxBlock1Y = Math.max(currentVendorY, y + (vAddress.length - 1) * 5) + 8;
    if (maxBlock1Y < y + 15) maxBlock1Y = y + 15;
    y = maxBlock1Y;

    // Block 2 Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(10, y, 190, 6, 'F');
    doc.setTextColor(255, 255, 255);
    if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'bold');
    else doc.setFont('times', 'bold');
    doc.text("Order by:", 12, y + 4);
    doc.text("Ship to:", 70, y + 4);
    doc.text("Delivery Date:", 130, y + 4);
    doc.text("Payment Term:", 165, y + 4);

    // Block 2 Data
    y += 10;
    doc.setTextColor(0, 0, 0);
    if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'normal');
    else doc.setFont('times', 'normal');

    let currentOrderY = y;
    doc.text(headerData['ordered_by_name'] || '', 12, currentOrderY);
    if (headerData['ordered_by_phone']) {
        currentOrderY += 5;
        doc.text(headerData['ordered_by_phone'] || '', 12, currentOrderY);
    }

    const sAddress = doc.splitTextToSize(headerData['Ship To'] || '', 55);
    doc.text(sAddress, 70, y);
    doc.text(formatDate(headerData['Delivery Date']), 130, y);
    doc.text(String(headerData['Payment Term'] || ''), 165, y);

    let maxBlock2Y = Math.max(currentOrderY, y + (sAddress.length - 1) * 5) + 12;

    // Table
    const head = [['No.', 'Item #', 'Description', 'Qty', 'Unit Price', 'Total']];
    const tableData: any[] = [];
    items.forEach(item => {
        if (!item.itemCode && !item.description && !item.modelName) return;

        const qty = typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty)) || 0;
        const amt = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0;
        const uPrice = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;

        const unitPriceStr = uPrice.toLocaleString('en-US', { minimumFractionDigits: 2 });
        const amountStr = amt.toLocaleString('en-US', { minimumFractionDigits: 2 });

        tableData.push([
            item.no,
            item.itemCode,
            item.description || item.modelName || "",
            item.qty,
            unitPriceStr,
            amountStr
        ]);
    });

    autoTable(doc, {
        startY: maxBlock2Y,
        head: head,
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: primaryColor as [number, number, number],
            textColor: [255, 255, 255],
            halign: 'center',
            valign: 'middle',
            font: (isKHR && isKhmerFontActive) ? 'KhmerOS' : 'times',
            fontSize: 9,
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
        },
        bodyStyles: {
            font: (isKHR && isKhmerFontActive) ? 'KhmerOS' : 'times',
            fontSize: 9,
            textColor: [0, 0, 0],
            lineWidth: 0.1,
            lineColor: [0, 0, 0],
            minCellHeight: 8,
            valign: 'middle'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 15 },
            1: { halign: 'center', cellWidth: 35 },
            2: { halign: 'left', cellWidth: 'auto' },
            3: { halign: 'center', cellWidth: 15 },
            4: { halign: 'right', cellWidth: 25 },
            5: { halign: 'right', cellWidth: 25 },
        },
        margin: { left: 10, right: 10 },
    });

    let currentY = (doc as any).lastAutoTable?.finalY || maxBlock2Y + 20;

    const drawTotalRow = (label: string, value: number, isLast: boolean = false) => {
        const leftMargin = 10;
        const tableWidth = 190;
        const totalColWidth = 25;
        const unitPriceColWidth = 25;

        const rectX = leftMargin;
        const labelEndX = leftMargin + tableWidth - totalColWidth;
        const valueEndX = leftMargin + tableWidth;
        const labelStartX = labelEndX - unitPriceColWidth;

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.1);
        doc.rect(rectX, currentY, tableWidth, 7);
        doc.line(labelEndX, currentY, labelEndX, currentY + 7);
        doc.line(labelStartX, currentY, labelStartX, currentY + 7);

        if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'bold');
        else doc.setFont('times', 'bold');
        doc.setFontSize(9);
        doc.text(label, labelEndX - 2, currentY + 4.5, { align: 'right' });

        const symbol = currency === 'KHR' ? 'R' : '$';
        doc.text(symbol, labelEndX + 2, currentY + 4.5, { align: 'left' });
        doc.text(value.toLocaleString('en-US', { minimumFractionDigits: 2 }), valueEndX - 2, currentY + 4.5, { align: 'right' });

        currentY += 7;
    };

    drawTotalRow("Sub Total:", totals.subTotal);
    const taxLabel = headerData['tax_type'] === 'NON-VAT' ? "Tax (0%):" : "VAT (10%):";
    drawTotalRow(taxLabel, totals.tax || totals.vat || 0);
    drawTotalRow("Grand Total:", totals.grandTotal, true);

    currentY += 20;

    if (currentY > 260) {
        doc.addPage();
        currentY = 20;
    }

    if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'bold');
    else doc.setFont('times', 'bold');

    const label1 = "PREPARED BY";
    const label3 = "APPROVED BY";

    doc.text(label1, layout.footer.preparedBy.x, currentY, { align: 'center' });
    doc.text(label3, layout.footer.approvedBy.x, currentY, { align: 'center' });

    currentY += 30;
    doc.line(layout.footer.preparedBy.x - 25, currentY, layout.footer.preparedBy.x + 25, currentY);
    doc.line(layout.footer.approvedBy.x - 25, currentY, layout.footer.approvedBy.x + 25, currentY);

    currentY += 6;
    if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'normal');
    else doc.setFont('times', 'normal');

    const preparedByName = headerData['Prepared By'] || "";
    const preparedByPos = headerData['Prepared By Position'] || "";
    if (preparedByName) {
        doc.text(preparedByName, layout.footer.preparedBy.x, currentY, { align: 'center' });
        doc.setFontSize(8);
        doc.text(preparedByPos, layout.footer.preparedBy.x, currentY + 4, { align: 'center' });
    }

    const approvedByName = headerData['Approved By'] || "";
    const approvedByPos = headerData['Approved By Position'] || "";
    if (approvedByName) {
        doc.setFontSize(9);
        doc.text(approvedByName, layout.footer.approvedBy.x, currentY, { align: 'center' });
        doc.setFontSize(8);
        doc.text(approvedByPos, layout.footer.approvedBy.x, currentY + 4, { align: 'center' });
    }

    if (previewMode) {
        return doc.output('datauristring');
    }
    doc.save(filename || 'PurchaseOrder.pdf');
    return;
}

export const generatePDF = async (options: GeneratePDFOptions): Promise<string | void> => {
    const { type, title, headerData, items, totals, currency, filename, layout: userLayout, previewMode = false } = options;
    const doc = new jsPDF();
    let layout = userLayout || defaultLayoutConfig;

    // Adjust layout for Sale Order (No Header)
    if (type === 'Sale Order') {
        // Deep clone to avoid mutating the global default config
        layout = JSON.parse(JSON.stringify(layout));

        // Shift content up by ~25mm since header is removed
        // Default Title Y: 43.5 -> ~18.5
        layout.title.y = Math.max(15, layout.title.y - 25);

        // Default Info Start Y: 50.4 -> ~25.4
        layout.info.startY = Math.max(22, layout.info.startY - 25);

        // Default Table Start Y: 85 -> ~60
        layout.table.startY = Math.max(50, layout.table.startY - 25);
    }

    const isKHR = currency === 'KHR';
    isKhmerFontActive = false;
    if (isKHR) {
        await loadKhmerFont(doc);
        if (isKhmerFontActive) {
            doc.setFont('KhmerOS');
        }
    }

    const primaryColor = [0, 74, 173]; // #004aad
    const black = [0, 0, 0];

    // Delegate Purchase Order to specialized generator
    if (type === 'Purchase Order') {
        const poPrimaryColor = [0, 84, 166];
        return generatePurchaseOrderPDF(doc, options, layout, isKHR, poPrimaryColor, black);
    }

    // --- Header Logo ---
    // Only show header for non-Sale Order documents
    if (type !== 'Sale Order') {
        const logoUrl = "https://i.postimg.cc/RFYdrpBC/Limperial-Technology-Logo01-png(004aad).png";
        try {
            const img = new Image();
            img.src = logoUrl;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            const logoWidth = layout.header.logo.width;
            const logoHeight = (img.height * logoWidth) / img.width;
            doc.addImage(img, 'PNG', layout.header.logo.x, layout.header.logo.y, logoWidth, logoHeight);
        } catch (e) {
            console.error("Failed to load logo", e);
            doc.setFontSize(14);
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.setFont('times', 'bold');
            doc.text("L'IMPERIAL TECHNOLOGY", 10, 20);
        }

        // Company Name
        doc.setFont('times', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFontSize(layout.header.companyName.fontSize);
        doc.text("LIMPERIAL TECHNOLOGY CO., LTD.", layout.header.companyName.x, layout.header.companyName.y);

        // Contact Details
        doc.setFont('times', 'normal');
        doc.setTextColor(black[0], black[1], black[2]);
        doc.setFontSize(layout.header.contactInfo.fontSize);
        doc.text(`Tel : (+855) 92 218 333 || Email : info@limperialtech.com || Website : www.limperialtech.com`, layout.header.contactInfo.x, layout.header.contactInfo.y);

        // Address
        doc.setFontSize(layout.header.address.fontSize || 9);
        const address = "Address : Building #15, Street Ayeaksmaiyean Bo (139), Sangkat Srah Chak, Khan Daun Penh, Phnom Penh, Cambodia.";
        doc.text(address, layout.header.address.x, layout.header.address.y, { maxWidth: layout.header.address.maxWidth });

        // Separator Line
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(layout.header.separatorLine.width);
        doc.line(10, layout.header.separatorLine.y, 200, layout.header.separatorLine.y);
    }

    // --- Document Title ---
    doc.setFontSize(layout.title.fontSize);
    if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'normal');
    else doc.setFont('times', 'bold');
    doc.setTextColor(0, 0, 0);
    const titleText = title.toUpperCase();
    const titleWidth = doc.getTextWidth(titleText);
    const titleX = (210 - titleWidth) / 2;
    doc.text(titleText, titleX, layout.title.y);

    // --- Info Section ---
    doc.setFontSize(layout.info.fontSize || 9);
    let y = layout.info.startY;

    const col1X = layout.info.col1.labelX;
    // Force 22mm width as requested
    const fixedLabelWidth = 22;
    const col1ColonX = col1X + fixedLabelWidth;
    const col1ValueX = col1ColonX + layout.info.col1.gap;

    const col2X = 150; // Shifted right to 150 as requested
    const col2ColonX = col2X + fixedLabelWidth;
    const col2ValueX = col2ColonX + layout.info.col2.gap;

    const drawRow = (label1: string, val1: string, label2: string, val2: string) => {
        if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'normal');
        else doc.setFont('times', 'normal');

        doc.text(label1, col1X, y);
        doc.text(":", col1ColonX, y);
        const splitVal1 = doc.splitTextToSize(String(val1 || ''), 90);
        doc.text(splitVal1, col1ValueX, y);

        doc.text(label2, col2X, y);
        doc.text(":", col2ColonX, y);
        doc.text(String(val2 || ''), col2ValueX, y);
        y += Math.max(splitVal1.length * 5, layout.info.rowHeight);
    };

    if (type === 'Quotation') {
        drawRow("Company Name", headerData['Company Name'], "Quotation No", headerData['Quotation ID']);
        drawRow("Address", headerData['Company Address'], "Quote Date", formatDate(headerData['Quote Date']));
        drawRow("Contact Name", headerData['Contact Person'], "Quote Validity", formatDate(headerData['Validity Date']));
        drawRow("Tel", headerData['Contact Tel'], "Status", headerData['Stock Status'] || 'Pending');
        drawRow("Email", headerData['Contact Email'], "Payment Term", headerData['Payment Term']);
    } else if (type === 'Sale Order') {
        drawRow("Company Name", headerData['Company Name'], "SO No", headerData['Sale Order ID']);
        drawRow("Address", headerData['Company Address'], "SO Date", formatDate(headerData['Order Date']));
        drawRow("Contact Name", headerData['Contact Person'], "Delivery Date", formatDate(headerData['Delivery Date']));
        drawRow("Tel", headerData['Contact Tel'], "Bill Invoice", headerData['Bill Invoice']);
        drawRow("Email", headerData['Email'], "Payment Term", headerData['Payment Term']);
    } else {
        drawRow("Company Name", headerData['Company Name'], type === 'Invoice' ? "Invoice No" : "DO No", headerData['Invoice No'] || headerData['DO No']);
        drawRow("Address", headerData['Company Address'] || headerData['Address'], "Date", formatDate(headerData['Date'] || headerData['Invoice Date']));
        drawRow("Contact Name", headerData['Contact Name'], "Reference", headerData['SO No'] || headerData['Reference']);
        drawRow("Tel", headerData['Contact Number'] || headerData['Phone Number'], "Payment Term", headerData['Payment Term']);
        drawRow("Email", headerData['Email'], "Tin No.", headerData['Tin No.']);
    }

    // --- Table ---
    const isDO = type === 'Delivery Order';
    const head = isDO
        ? [['No.', 'Item Code', 'Description', 'Qty']]
        : [['No.', 'Item Code', 'Description', 'Qty', 'Unit Price', 'Total']];

    const tableData: any[] = [];
    items.forEach(item => {
        if (!item.itemCode && !item.description && !item.modelName) return;

        if (isDO) {
            tableData.push([item.no, item.itemCode, item.modelName || "", item.qty]);
            if (item.description) tableData.push(["", "", item.description, ""]);
        } else {
            const qty = typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty)) || 0;
            const amt = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0;
            const uPrice = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
            const cm = typeof item.commission === 'number' ? item.commission : parseFloat(String(item.commission)) || 0;
            const displayUnitPrice = qty > 0 ? (amt / qty) : (uPrice + cm);

            const symbol = getCurrencySymbol(currency);
            const unitPriceStr = `${symbol} ${displayUnitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            const amountStr = `${symbol} ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

            // For Sale Order: combine model name and description in the same row
            // For Quotation: keep model name and description on separate rows
            if (type === 'Sale Order') {
                const combinedDescription = item.modelName
                    ? (item.description ? `${item.modelName} - ${item.description}` : item.modelName)
                    : (item.description || "");

                tableData.push([
                    item.no,
                    item.itemCode,
                    combinedDescription,
                    item.qty,
                    unitPriceStr,
                    amountStr
                ]);
            } else {
                // Quotation: separate rows for model and description
                tableData.push([
                    item.no,
                    item.itemCode,
                    item.modelName || "",
                    item.qty,
                    unitPriceStr,
                    amountStr
                ]);
                if (item.description) tableData.push(["", "", item.description, "", "", ""]);
            }
        }
    });

    autoTable(doc, {
        startY: layout.table.startY,
        head: head,
        body: tableData,
        headStyles: {
            fillColor: primaryColor as [number, number, number],
            textColor: [255, 255, 255],
            halign: 'center',
            valign: 'middle',
            font: (isKHR && isKhmerFontActive) ? 'KhmerOS' : 'times',
            fontSize: layout.table.fontSize,
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
        },
        bodyStyles: {
            font: (isKHR && isKhmerFontActive) ? 'KhmerOS' : 'times',
            fontSize: layout.table.fontSize,
            textColor: [0, 0, 0],
            lineWidth: 0.1,
            lineColor: [0, 0, 0],
            minCellHeight: 7,
            valign: 'middle'
        },
        columnStyles: isDO ? {
            0: { halign: 'center', cellWidth: layout.table.columnWidths.no },
            1: { halign: 'center', cellWidth: layout.table.columnWidths.itemCode },
            2: { halign: 'left', cellWidth: 'auto', fontSize: layout.table.descriptionFontSize },
            3: { halign: 'center', cellWidth: layout.table.columnWidths.qty },
        } : {
            0: { halign: 'center', cellWidth: layout.table.columnWidths.no },
            1: { halign: 'center', cellWidth: layout.table.columnWidths.itemCode },
            2: { halign: 'left', cellWidth: 'auto', fontSize: layout.table.descriptionFontSize },
            3: { halign: 'center', cellWidth: layout.table.columnWidths.qty },
            4: { halign: 'right', cellWidth: layout.table.columnWidths.unitPrice },
            5: { halign: 'right', cellWidth: layout.table.columnWidths.total },
        },
        theme: 'grid',
        margin: { left: layout.table.margins.left, right: layout.table.margins.right },
        didParseCell: (data: any) => {
            if (!isDO && (data.column.index === 4 || data.column.index === 5) && data.section === 'body') {
                const text = data.cell.text[0];
                if (text && /[^\d.,\s]/.test(text)) {
                    (data.cell as any)._currencyValue = text;
                    data.cell.text = [''];
                }
            }
        },
        didDrawCell: (data: any) => {
            if (!isDO && (data.column.index === 4 || data.column.index === 5) && data.section === 'body') {
                const originalText = (data.cell as any)._currencyValue;
                if (originalText) {
                    const symbol = originalText.includes('$') ? '$' : RIEL_SYMBOL;
                    const value = originalText.replace(symbol, '').trim();
                    const { x, y, width, height } = data.cell;
                    const padding = 2;
                    const centerY = y + (height / 2) + 1.2;
                    const fontSize = data.cell.styles.fontSize || layout.table.fontSize;

                    doc.setFont('times', 'normal');
                    doc.setFontSize(fontSize);
                    doc.text(symbol, x + padding, centerY, { align: 'left' });
                    doc.text(value, x + width - padding, centerY, { align: 'right' });
                }
            }
        }
    });

    let currentY = (doc as any).lastAutoTable.finalY || layout.table.startY;

    // --- Totals Section ---
    if (!isDO) {
        const drawTotalLine = (label1: string, val1: number) => {
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.1);
            const leftMargin = layout.table.margins.left;
            const rightMargin = layout.table.margins.right;
            const tableWidth = 210 - leftMargin - rightMargin;
            const totalColWidth = layout.table.columnWidths.total;
            const labelEndX = leftMargin + tableWidth - totalColWidth;
            const valueStartX = labelEndX;
            const valueEndX = leftMargin + tableWidth;

            doc.rect(leftMargin, currentY, tableWidth, 7);
            doc.line(labelEndX, currentY, labelEndX, currentY + 7);

            if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'bold');
            else doc.setFont('times', 'bold');
            doc.setFontSize(9);
            doc.text(label1, labelEndX - 1, currentY + 5, { align: 'right' });

            const symbol = isKHR ? 'R' : '$'; // Use 'R' for Riel symbol
            doc.setTextColor(0, 0, 0);
            doc.setFont('times', 'bold');
            doc.text(symbol, valueStartX + 1, currentY + 5, { align: 'left' });

            doc.setFont('times', 'bold');
            doc.text(val1.toLocaleString('en-US', { minimumFractionDigits: 2 }), valueEndX - 1, currentY + 5, { align: 'right' });
            currentY += 7;
        };

        drawTotalLine(`Sub Total (${currency})`, totals.subTotal);
        drawTotalLine(`VAT 10% (${currency})`, totals.tax || totals.vat || 0);
        drawTotalLine(`Grand Total (${currency})`, totals.grandTotal);
    }

    // --- Remarks ---
    currentY += layout.terms.spacingBefore;

    if (type === 'Sale Order') {
        if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'bold');
        else doc.setFont('times', 'bold');
        doc.setFontSize(layout.terms.titleFontSize);
        doc.text("Set up software:", layout.table.margins.left, currentY);
        currentY += 6;

        if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'normal');
        else doc.setFont('times', 'normal');
        doc.setFontSize(layout.terms.contentFontSize);

        const selectedSoftware = (headerData['Install Software'] || '').split(',').map((s: string) => s.trim()).filter((s: string) => s);

        let xPos = layout.table.margins.left;
        // Adjust grid for software options
        const colWidth = 45;
        const checkSize = 3.5;

        // Iterate ONLY selected software
        selectedSoftware.forEach((option: string) => {
            // Check if we need a new line (e.g., every 4 items or if width exceeds)
            if (xPos + colWidth > 190) {
                xPos = layout.table.margins.left;
                currentY += 6;
            }

            // Draw check box
            doc.setDrawColor(0, 0, 0);
            doc.rect(xPos, currentY - checkSize, checkSize, checkSize);

            // Always checked since we are only iterating selected ones
            // Draw check mark (tick) instead of X
            doc.setLineWidth(0.4);
            const startX = xPos + (checkSize * 0.2);
            const startY = currentY - (checkSize * 0.45);
            const midX = xPos + (checkSize * 0.45);
            const midY = currentY - (checkSize * 0.15);
            const endX = xPos + (checkSize * 0.85);
            const endY = currentY - (checkSize * 0.8);

            doc.line(startX, startY, midX, midY);
            doc.line(midX, midY, endX, endY);

            doc.text(option, xPos + checkSize + 2, currentY);
            xPos += colWidth;
        });

        // Add extra line if we had any options
        if (selectedSoftware.length > 0) {
            currentY += 8;
        } else {
            // If no options, maybe don't add 8mm
            currentY += 2;
        }

        // Add Remark if present for Sale Order
        if (headerData['Remark']) {
            if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'bold');
            else doc.setFont('times', 'bold');
            doc.text("Remark:", layout.table.margins.left, currentY);
            currentY += 5;

            if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'normal');
            else doc.setFont('times', 'normal');
            const splitRemark = doc.splitTextToSize(headerData['Remark'], 210 - layout.table.margins.left - layout.table.margins.right);
            doc.text(splitRemark, layout.table.margins.left, currentY);
            currentY += splitRemark.length * 4;
        }

    } else {
        if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'bold');
        else doc.setFont('times', 'bold');
        doc.setFontSize(layout.terms.titleFontSize);
        doc.text("Terms and Conditions", layout.table.margins.left, currentY);

        currentY += 5;
        if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'normal');
        else doc.setFont('times', 'normal');
        doc.setFontSize(layout.terms.contentFontSize);
        const remarks = headerData['Terms and Conditions'] || headerData['Remark'] || "Warranty details...";
        const splitRemarks = doc.splitTextToSize(remarks, 210 - layout.table.margins.left - layout.table.margins.right);
        doc.text(splitRemarks, layout.table.margins.left, currentY);
        currentY += splitRemarks.length * 4;
    }

    // --- Signatures ---
    // Dynamic positioning: use footer.y if content is short, otherwise add spacing after content
    // Ensure signatures stay near bottom while maintaining minimum spacing from content
    const minSpacingFromContent = 5; // Reduced to 5mm to move signature block closer
    const contentEndY = currentY + minSpacingFromContent;
    currentY = Math.max(contentEndY, layout.footer.y);

    // If signatures would overflow page, move to new page
    if (currentY > 270) {
        doc.addPage();
        currentY = 20;
    }

    if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'bold');
    else doc.setFont('times', 'bold');

    const label1 = type === 'Sale Order' ? "ORDERED BY" : "PREPARED BY";
    const label2 = type === 'Delivery Order' ? "DELIVERED BY" : "";
    const label3 = type === 'Sale Order' ? "RECEIVED BY" : (type === 'Quotation' ? "APPROVED BY" : "RECEIVED BY");

    doc.text(label1, layout.footer.preparedBy.x, currentY, { align: 'center' });
    if (label2) doc.text(label2, layout.footer.middlePosition?.x || 105, currentY, { align: 'center' });
    doc.text(label3, layout.footer.approvedBy.x, currentY, { align: 'center' });

    currentY += 30; // Bigger space for signature
    doc.line(layout.footer.preparedBy.x - 25, currentY, layout.footer.preparedBy.x + 25, currentY);
    if (label2) doc.line((layout.footer.middlePosition?.x || 105) - 25, currentY, (layout.footer.middlePosition?.x || 105) + 25, currentY);
    doc.line(layout.footer.approvedBy.x - 25, currentY, layout.footer.approvedBy.x + 25, currentY);

    currentY += 10; // Bigger space between signature line and name/position
    if (isKHR && isKhmerFontActive) doc.setFont('KhmerOS', 'normal');
    else doc.setFont('times', 'normal');

    const preparedByName = headerData['Prepared By'] || headerData['Created By'] || "";
    const preparedByPos = headerData['Prepared By Position'] || "";
    doc.text(preparedByName, layout.footer.preparedBy.x, currentY, { align: 'center' });
    doc.setFontSize(layout.table.fontSize - 1);
    doc.text(preparedByPos, layout.footer.preparedBy.x, currentY + 4, { align: 'center' });

    const approvedByName = headerData['Approved By'] || "";
    const approvedByPos = headerData['Approved By Position'] || "";
    if (approvedByName) {
        doc.setFontSize(layout.table.fontSize);
        doc.text(approvedByName, layout.footer.approvedBy.x, currentY, { align: 'center' });
        doc.setFontSize(layout.table.fontSize - 1);
        doc.text(approvedByPos, layout.footer.approvedBy.x, currentY + 4, { align: 'center' });
    }

    if (previewMode) return doc.output('datauristring');
    doc.save(filename);
};
