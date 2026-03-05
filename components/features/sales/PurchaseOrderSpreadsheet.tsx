import React, { useRef, useState, useEffect } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { Button } from "../../ui/button";
import { PurchaseOrderItem } from "../../../types";
import { Upload, Download, Save, X } from "lucide-react";
import * as xlsx from 'xlsx';

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

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = xlsx.read(data, { type: 'array' });

            const sheets: any[] = [];
            workbook.SheetNames.forEach((name, index) => {
                const worksheet = workbook.Sheets[name];
                const json = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false });

                const celldata: any[] = [];
                (json as any[][]).forEach((row: any[], rIndex: number) => {
                    row.forEach((cellValue: any, cIndex: number) => {
                        if (cellValue !== null && cellValue !== undefined && cellValue !== "") {
                            celldata.push({
                                r: rIndex,
                                c: cIndex,
                                v: {
                                    v: cellValue,
                                    m: String(cellValue)
                                }
                            });
                        }
                    });
                });

                sheets.push({
                    name,
                    id: `sheet_${index}`,
                    celldata,
                    status: index === 0 ? 1 : 0
                });
            });

            if (sheets.length > 0) {
                setSheetData(sheets);
            }
            e.target.value = ''; // Reset file input
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExportXlsx = async () => {
        const allSheets = workbookRef.current?.getAllSheets?.() || sheetData;
        const wb = xlsx.utils.book_new();

        allSheets.forEach((sheet: any) => {
            const data = sheet.data || [];
            if (!data.length) return;

            const rows: any[][] = [];
            data.forEach((row: any[], rIdx: number) => {
                rows[rIdx] = [];
                row.forEach((cell: any, cIdx: number) => {
                    if (cell && cell.v !== undefined && cell.v !== null) {
                        rows[rIdx][cIdx] = cell.v;
                    } else if (cell && cell.m) {
                        rows[rIdx][cIdx] = cell.m;
                    } else {
                        rows[rIdx][cIdx] = null;
                    }
                });
            });

            const ws = xlsx.utils.aoa_to_sheet(rows);

            // Add merges if present in config
            if (sheet.config?.merge) {
                const merges = Object.values(sheet.config.merge).map((m: any) => ({
                    s: { r: m.r, c: m.c },
                    e: { r: m.r + m.rs - 1, c: m.c + m.cs - 1 }
                }));
                ws['!merges'] = merges;
            }

            xlsx.utils.book_append_sheet(wb, ws, sheet.name || 'Sheet1');
        });

        const workbookBuffer = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([workbookBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${formData?.po_number || 'PurchaseOrder'}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
                            Export XLSX
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
