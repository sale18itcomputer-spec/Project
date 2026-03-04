import React, { useRef, useState, useEffect } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { Button } from "../../ui/button";
import { PurchaseOrderItem } from "../../../types";
import { Upload, Download, Save, X } from "lucide-react";
import * as xlsx from 'xlsx';
import LuckyExcel from 'luckyexcel';
import { saveAs } from 'file-saver';
import * as ExcelJS from 'exceljs';
import { transformFortuneToExcel } from '@corbe30/fortune-excel';

interface PurchaseOrderSpreadsheetProps {
    isOpen: boolean;
    onClose: () => void;
    initialItems: PurchaseOrderItem[];
    formData: any;
    totals?: any;
    onSave: (items: PurchaseOrderItem[]) => void;
}

const stripHtml = (html: string) => {
    if (!html) return '';
    if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
};

export default function PurchaseOrderSpreadsheet({
    isOpen,
    onClose,
    initialItems,
    formData,
    onSave
}: PurchaseOrderSpreadsheetProps) {
    const [sheetData, setSheetData] = useState<any[]>([]);

    const workbookRef = useRef<any>(null);

    useEffect(() => {
        if (!isOpen) return;

        const PRIMARY_COLOR = "#005eb8";
        const PRIMARY_TEXT_COLOR = "#ffffff";

        let celldata: any[] = [];
        let merges: any = {};

        const setCellInfo = (r: number, c: number, v: string | number, m: string, isFormula: boolean = false, formatting: any = {}) => {
            const cellVal: any = { v: v, m: m };
            if (isFormula) {
                cellVal.f = m;
            }
            celldata.push({ r, c, v: { ...cellVal, ...formatting } });
        };

        const createMerge = (key: string, r: number, c: number, rs: number, cs: number) => {
            merges[key] = { r, c, rs, cs };
        };

        // R2: Title
        setCellInfo(2, 0, "PURCHASE ORDER", "PURCHASE ORDER", false, { bl: 1, fc: PRIMARY_COLOR, ff: "Arial", fs: 18, vt: 0, ht: 0 });
        createMerge("2_0", 2, 0, 1, 6);

        // Header Style
        const headerStyle = { bg: PRIMARY_COLOR, fc: PRIMARY_TEXT_COLOR, bl: 1, vt: 0, ff: "Arial", fs: 11 };

        // R4: Vendor Info Header
        setCellInfo(4, 0, "Vendor Name:", "Vendor Name:", false, headerStyle);
        createMerge("4_0", 4, 0, 1, 2);
        setCellInfo(4, 2, "Address:", "Address:", false, headerStyle);
        setCellInfo(4, 3, "Order Date:", "Order Date:", false, headerStyle);
        createMerge("4_3", 4, 3, 1, 2);
        setCellInfo(4, 5, "PO Number # :", "PO Number # :", false, headerStyle);

        // R5: Vendor Info Data
        const addressLines = (formData?.vendor_address || "").split('\n');
        setCellInfo(5, 0, formData?.vendor_name || "", String(formData?.vendor_name || ""), false, { vt: 0, ff: "Arial" });
        createMerge("5_0", 5, 0, 1, 2);
        setCellInfo(5, 2, addressLines[0] || "", addressLines[0] || "", false, { vt: 0, ff: "Arial" });
        setCellInfo(5, 3, formData?.order_date || "", String(formData?.order_date || ""), false, { vt: 0, ff: "Arial" });
        createMerge("5_3", 5, 3, 1, 2);
        setCellInfo(5, 5, formData?.po_number || "", String(formData?.po_number || ""), false, { vt: 0, ff: "Arial" });

        // R6: Vendor Info Data 2
        setCellInfo(6, 0, formData?.vendor_contact || "", String(formData?.vendor_contact || ""), false, { vt: 0 });
        createMerge("6_0", 6, 0, 1, 2);
        setCellInfo(6, 2, addressLines[1] || "", addressLines[1] || "", false, { vt: 0 });

        // R7: Vendor Info Data 3
        setCellInfo(7, 0, formData?.vendor_phone || "", String(formData?.vendor_phone || ""), false, { vt: 0 });
        createMerge("7_0", 7, 0, 1, 2);
        setCellInfo(7, 2, addressLines[2] || "", addressLines[2] || "", false, { vt: 0 });

        // R9: Ship To Header
        setCellInfo(9, 0, "Order by:", "Order by:", false, headerStyle);
        createMerge("9_0", 9, 0, 1, 2);
        setCellInfo(9, 2, "Ship to:", "Ship to:", false, headerStyle);
        setCellInfo(9, 3, "Delivery Date:", "Delivery Date:", false, headerStyle);
        createMerge("9_3", 9, 3, 1, 2);
        setCellInfo(9, 5, "Payment Term:", "Payment Term:", false, headerStyle);

        // R10: Ship To Data
        setCellInfo(10, 0, formData?.ordered_by_name || "", String(formData?.ordered_by_name || ""), false, { vt: 0 });
        createMerge("10_0", 10, 0, 1, 2);
        setCellInfo(10, 2, (formData?.ship_to_address || "").replace(/\n/g, ' '), String(formData?.ship_to_address || "").replace(/\n/g, ' '), false, { tb: 2, vt: 0 });
        setCellInfo(10, 3, formData?.delivery_date || "", String(formData?.delivery_date || ""), false, { vt: 0 });
        createMerge("10_3", 10, 3, 1, 2);
        setCellInfo(10, 5, formData?.payment_term || "", String(formData?.payment_term || ""), false, { vt: 0 });

        // R12: Items Header
        const itemsHeaderStyle = { ...headerStyle, ht: 0 };
        setCellInfo(12, 0, "No.", "No.", false, itemsHeaderStyle);
        setCellInfo(12, 1, "Item #", "Item #", false, itemsHeaderStyle);
        setCellInfo(12, 2, "Description", "Description", false, itemsHeaderStyle);
        setCellInfo(12, 3, "Qty", "Qty", false, itemsHeaderStyle);
        setCellInfo(12, 4, "Unit Price", "Unit Price", false, itemsHeaderStyle);
        setCellInfo(12, 5, "Total", "Total", false, itemsHeaderStyle);

        // R13+ Items Data
        let currentRow = 13;
        initialItems.forEach((item, index) => {
            const desc = stripHtml(item.description || "");
            setCellInfo(currentRow, 0, item.line_number, String(item.line_number), false, { ht: 0, vt: 0 });
            setCellInfo(currentRow, 1, item.item_number || "", String(item.item_number || ""), false, { ht: 0, vt: 0 });
            setCellInfo(currentRow, 2, desc, desc, false, { tb: 2, vt: 0 }); // tb: 2 is wrap text
            setCellInfo(currentRow, 3, Number(item.qty) || 0, String(item.qty || 0), false, { ht: 0, vt: 0, ct: { fa: "General", t: "n" } });
            setCellInfo(currentRow, 4, Number(item.unit_price) || 0, String(item.unit_price || 0), false, { ht: 2, vt: 0, ct: { fa: "#,##0.00", t: "n" } });

            // Formula for total: =D{r}*E{r} Note: row is 1-indexed for formulas
            const excelRow = currentRow + 1;
            setCellInfo(currentRow, 5, "", `=D${excelRow}*E${excelRow}`, true, { ht: 2, vt: 0, ct: { fa: "#,##0.00", t: "n" }, bg: "#f9fafb" });

            currentRow++;
        });

        // Ensure at least 3 blank rows if items are too few
        while (currentRow < 16) {
            currentRow++;
        }

        const itemsLastRow = currentRow - 1;

        // Sub Total
        const subtotalStyle = { bl: 1, ht: 2, vt: 0, bg: "#f9fafb" };
        setCellInfo(currentRow, 4, "Sub Total :", "Sub Total :", false, subtotalStyle);
        // itemsLastRow + 1 converts 0-indexed index to 1-indexed Excel row
        setCellInfo(currentRow, 5, "", `=SUM(F14:F${itemsLastRow + 1})`, true, { ...subtotalStyle, ct: { fa: "#,##0.00", t: "n" } });
        currentRow++;

        // VAT / Tax
        const isVAT = formData?.tax_type === 'VAT';
        const taxStyle = { bl: 1, ht: 2, vt: 0, bg: "#f9fafb" };
        setCellInfo(currentRow, 4, isVAT ? "VAT (10%) :" : "Tax (0%) :", isVAT ? "VAT (10%) :" : "Tax (0%) :", false, taxStyle);

        if (isVAT) {
            // currentRow currently points to the index for VAT row (e.g. 15), 
            // the row above (subtotal) is Excel row 15 (currentRow).
            setCellInfo(currentRow, 5, "", `=F${currentRow}*0.1`, true, { ...taxStyle, ct: { fa: "#,##0.00", t: "n" } });
        } else {
            setCellInfo(currentRow, 5, 0, "0.00", false, { ...taxStyle, ct: { fa: "#,##0.00", t: "n" } });
        }
        currentRow++;

        // Grand Total
        setCellInfo(currentRow, 4, "Grand Total :", "Grand Total :", false, { bl: 1, ht: 2, vt: 0, bg: "#f9fafb" });
        setCellInfo(currentRow, 5, "", `=F${currentRow - 1}+F${currentRow}`, true, { bl: 1, ht: 2, vt: 0, ct: { fa: "#,##0.00", t: "n" }, bg: "#f9fafb" });

        const totalsLastRow = currentRow;

        currentRow += 4; // Spacing to signatures

        // Signatures
        setCellInfo(currentRow, 0, "PREPARED BY", "PREPARED BY", false, { bl: 1, ht: 0 });
        createMerge(`${currentRow}_0`, currentRow, 0, 1, 2);
        setCellInfo(currentRow, 3, "APPROVED BY", "APPROVED BY", false, { bl: 1, ht: 0 });
        createMerge(`${currentRow}_3`, currentRow, 3, 1, 2);

        currentRow += 5; // Spacing for signature line
        setCellInfo(currentRow, 0, "__________________________", "__________________________", false, { ht: 0 });
        createMerge(`${currentRow}_0`, currentRow, 0, 1, 2);
        setCellInfo(currentRow, 3, "__________________________", "__________________________", false, { ht: 0 });
        createMerge(`${currentRow}_3`, currentRow, 3, 1, 2);

        currentRow += 1;
        setCellInfo(currentRow, 0, formData?.prepared_by || "", String(formData?.prepared_by || ""), false, { ht: 0 });
        createMerge(`${currentRow}_0`, currentRow, 0, 1, 2);
        setCellInfo(currentRow, 3, formData?.approved_by || "", String(formData?.approved_by || ""), false, { ht: 0 });
        createMerge(`${currentRow}_3`, currentRow, 3, 1, 2);

        currentRow += 1;
        setCellInfo(currentRow, 0, formData?.prepared_by_position || "", String(formData?.prepared_by_position || ""), false, { ht: 0, fs: 9, fc: "#666" });
        createMerge(`${currentRow}_0`, currentRow, 0, 1, 2);
        setCellInfo(currentRow, 3, formData?.approved_by_position || "", String(formData?.approved_by_position || ""), false, { ht: 0, fs: 9, fc: "#666" });
        createMerge(`${currentRow}_3`, currentRow, 3, 1, 2);


        // Combine Borders
        const borderInfo = [
            // Vendor Table
            { rangeType: "range", borderType: "border-all", style: "1", color: "#000", range: [{ row: [4, 7], column: [0, 5] }] },
            // Ship To Table
            { rangeType: "range", borderType: "border-all", style: "1", color: "#000", range: [{ row: [9, 10], column: [0, 5] }] },
            // Items Table + Totals Table
            { rangeType: "range", borderType: "border-all", style: "1", color: "#000", range: [{ row: [12, totalsLastRow], column: [0, 5] }] },
            // Make columns C to F border internal for items
        ];

        setSheetData([{
            name: "Purchase Order",
            id: "sheet_01",
            status: 1,
            celldata,
            config: {
                merge: merges,
                borderInfo: borderInfo,
                columnlen: {
                    0: 60,
                    1: 150,
                    2: 400,
                    3: 100,
                    4: 120,
                    5: 120
                },
                rowlen: {
                    2: 40 // Make title row taller
                }
            }
        }]);

    }, [isOpen, initialItems, formData]);

    const handleImportXlsx = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        LuckyExcel.transformExcelToLucky(file, (exportJson: any) => {
            if (exportJson.sheets && exportJson.sheets.length > 0) {
                setSheetData(exportJson.sheets);
            }
            e.target.value = ''; // Reset file input
        });
    };

    const handleExportXlsx = async () => {
        // Get latest edited data from workbook instance or fallback to state
        const allSheets = workbookRef.current?.getAllSheets?.() || sheetData;

        try {
            // FIX: The plugin expects a workbook instance/ref with a .getAllSheets() method.
            // Wrapping our captured data in this mock object satisfies the requirement.
            const blob = await transformFortuneToExcel({
                getAllSheets: () => allSheets
            });
            saveAs(blob, `${formData?.po_number || 'PurchaseOrder'}.xlsx`);
        } catch (error) {
            console.error("High-fidelity plugin export failed, falling back to manual engine:", error);

            // Fallback: Manual ExcelJS construction
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Purchase Order');

            const sheet = allSheets[0];
            const data = sheet.data || [];
            const config = sheet.config || {};

            // 1. Dynamic Column Widths
            if (config.columnlen) {
                Object.keys(config.columnlen).forEach((colIdx) => {
                    const width = config.columnlen[colIdx];
                    // Fortune-sheet width to exceljs width conversion (approximate)
                    ws.getColumn(parseInt(colIdx) + 1).width = width / 7.5;
                });
            }

            // 2. Dynamic Merges
            if (config.merge) {
                Object.values(config.merge).forEach((merge: any) => {
                    ws.mergeCells(merge.r + 1, merge.c + 1, merge.r + merge.rs, merge.c + merge.cs);
                });
            }

            // 3. Dynamic Data & Styles
            data.forEach((row: any[], rIdx: number) => {
                if (config.rowlen && config.rowlen[rIdx]) {
                    ws.getRow(rIdx + 1).height = config.rowlen[rIdx] * 0.75;
                }

                row.forEach((cell: any, cIdx: number) => {
                    if (!cell) return;
                    const excelCell = ws.getCell(rIdx + 1, cIdx + 1);

                    // Value & Formulas
                    if (cell.f) {
                        excelCell.value = { formula: cell.f.startsWith('=') ? cell.f.substring(1) : cell.f };
                    } else {
                        excelCell.value = cell.v !== undefined ? cell.v : (cell.m || '');
                    }

                    // Styles
                    const style: Partial<ExcelJS.Style> = {};

                    // Font (Size, Bold, Italic, Color)
                    const font: Partial<ExcelJS.Font> = { name: 'Arial' };
                    if (cell.fs) font.size = cell.fs;
                    if (cell.bl) font.bold = true;
                    if (cell.it) font.italic = true;
                    if (cell.fc) {
                        const color = cell.fc.replace('#', '');
                        font.color = { argb: color.length === 6 ? 'FF' + color : color };
                    }
                    style.font = font;

                    // Fill (Background Color)
                    if (cell.bg) {
                        const color = cell.bg.replace('#', '');
                        style.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: color.length === 6 ? 'FF' + color : color }
                        };
                    }

                    // Alignment
                    const alignment: Partial<ExcelJS.Alignment> = { vertical: 'middle' };
                    if (cell.ht === 0) alignment.horizontal = 'center';
                    else if (cell.ht === 2) alignment.horizontal = 'right';
                    else alignment.horizontal = 'left';

                    if (cell.tb === 2) alignment.wrapText = true;
                    style.alignment = alignment;

                    // Number Format
                    if (cell.ct && cell.ct.fa) {
                        style.numFmt = cell.ct.fa;
                    }

                    // Borders (Simplified: applying thin borders where detected)
                    style.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };

                    excelCell.style = style;
                });
            });

            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `${formData?.po_number || 'PurchaseOrder'}.xlsx`);
        }
    };

    const handleSave = () => {
        if (!workbookRef.current) return;

        const allData = workbookRef.current.getAllSheets();
        const sheet = allData.find((s: any) => s.status === 1) || allData[0];
        const data = sheet.data || [];

        const rows: any[][] = [];
        data.forEach((row: any[], rIndex: number) => {
            if (!rows[rIndex]) rows[rIndex] = [];
            row.forEach((cell: any, cIndex: number) => {
                rows[rIndex][cIndex] = cell ? (cell.v !== undefined && cell.v !== null ? cell.v : cell.m) : '';
            });
        });

        const newItems: PurchaseOrderItem[] = [];

        // Scan items starting from Row 13 (index 13 which is actually row 14) down
        // Stop when we hit "Sub Total" logic
        for (let i = 13; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            // If we hit sub total, stop collecting items
            const isSubTotal = String(row[4] || '').replace(/\s+/g, '').toLowerCase() === 'subtotal:';
            if (isSubTotal) break;

            const lineNumStr = String(row[0] || '').trim();
            const itemNum = String(row[1] || '').trim();
            const desc = String(row[2] || '').trim();
            const qtyStr = String(row[3] || '').trim();
            const priceStr = String(row[4] || '').trim();

            const isBlankRow = !itemNum && !desc && !qtyStr && !priceStr && !lineNumStr;
            if (isBlankRow) continue;

            const lineNum = parseInt(lineNumStr) || (newItems.length + 1);
            const qty = parseFloat(qtyStr.replace(/,/g, '')) || 1;
            const price = parseFloat(priceStr.replace(/,/g, '')) || 0;

            if (desc || qty || price || itemNum) {
                newItems.push({
                    line_number: lineNum,
                    item_number: itemNum,
                    description: desc,
                    qty: qty,
                    unit_price: price
                });
            }
        }

        if (newItems.length === 0) {
            newItems.push({
                line_number: 1,
                item_number: '',
                description: '',
                qty: 1,
                unit_price: 0
            });
        }

        onSave(newItems);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full h-full max-w-[100vw] max-h-[100vh] bg-white rounded-lg shadow-xl flex flex-col p-4 animate-in zoom-in-95 duration-200">
                <div className="flex flex-row items-center justify-between pb-4 border-b">
                    <h2 className="text-xl font-bold">Excel-Like Spreadsheet Editor</h2>
                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            id="import-excel"
                            accept=".xlsx"
                            className="hidden"
                            onChange={handleImportXlsx}
                        />
                        <Button variant="outline" onClick={() => document.getElementById('import-excel')?.click()}>
                            <Upload className="w-4 h-4 mr-2" />
                            Import XLSX
                        </Button>
                        <Button variant="outline" onClick={handleExportXlsx}>
                            <Download className="w-4 h-4 mr-2" />
                            Export XLSX (Download Formatted PDF)
                        </Button>
                        <Button onClick={handleSave} className="bg-primary text-white hover:bg-primary/90">
                            <Save className="w-4 h-4 mr-2" />
                            Save & Close
                        </Button>
                        <button onClick={onClose} className="ml-2 p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 w-full bg-slate-100 relative mt-4 border rounded-md overflow-hidden min-h-[500px]">
                    {sheetData.length > 0 && (
                        <Workbook
                            ref={workbookRef}
                            data={sheetData}
                            onChange={(data) => {
                                // optional tracking
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
