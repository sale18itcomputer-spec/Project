'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PurchaseOrder, PurchaseOrderItem, Vendor } from "../../types";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { supabase } from "../../lib/supabase";
import { ArrowLeft, Plus, Trash2, Save, Printer, Package, User, Building2, Calendar, CreditCard, ShoppingCart, CheckCircle, PanelRight, Download, SlidersHorizontal, Loader2 } from 'lucide-react';
import { FormSection, FormInput, FormTextarea, FormSelect } from "../common/FormControls";
import { formatCurrencySmartly } from "../../utils/formatters";
import { formatToInputDate } from "../../utils/time";
import { getSetting, saveSetting } from "../../services/api";
import DocumentEditorContainer from "../layout/DocumentEditorContainer";
import PDFConfigModal from "../modals/PDFConfigModal";
import PDFControlField from "../pdf/PDFControlField";
import { PDFLayoutConfig, defaultLayoutConfig, generatePDF } from "../../utils/pdfGenerator";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const STRIP_HTML = (html: string) => {
    if (!html) return '';
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        let text = '';
        const processNode = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const tagName = el.tagName.toLowerCase();

                if (tagName === 'br') text += '\n';

                // Add newline before block elements if not already there
                if ((tagName === 'p' || tagName === 'div' || tagName === 'ul' || tagName === 'ol' || tagName.match(/^h[1-6]$/)) && text.length > 0 && !text.endsWith('\n')) {
                    text += '\n';
                }

                if (tagName === 'li') {
                    if (text.length > 0 && !text.endsWith('\n')) text += '\n';
                    const parent = el.parentElement;
                    if (parent && parent.tagName.toLowerCase() === 'ol') {
                        const index = Array.from(parent.children).indexOf(el) + 1;
                        text += `  ${index}. `;
                    } else {
                        text += '  - ';
                    }
                }

                // Handle indentation classes from Quill
                if (el.className && typeof el.className === 'string' && el.className.includes('ql-indent-')) {
                    const match = el.className.match(/ql-indent-(\d+)/);
                    if (match && match[1]) {
                        const indentLevel = parseInt(match[1], 10);
                        text += '    '.repeat(indentLevel);
                    }
                }

                node.childNodes.forEach(processNode);

                // Add newline after block elements
                if (tagName === 'p' || tagName === 'div' || tagName === 'li' || tagName.match(/^h[1-6]$/)) {
                    if (!text.endsWith('\n')) text += '\n';
                }
            }
        };
        doc.body.childNodes.forEach(processNode);

        return text.replace(/\n{3,}/g, '\n\n').trim();
    } catch (e) {
        let fallback = html.replace(/<br\s*[\/]?>/gi, '\n');
        fallback = fallback.replace(/<\/p><p>/gi, '\n');
        fallback = fallback.replace(/<li[^>]*>/gi, '  - ');
        fallback = fallback.replace(/<\/div><div>/gi, '\n');
        fallback = fallback.replace(/<\/p>/gi, '\n');
        fallback = fallback.replace(/<\/div>/gi, '\n');
        fallback = fallback.replace(/<\/li>/gi, '\n');
        fallback = fallback.replace(/<[^>]+>/ig, '');
        return fallback.trim();
    }
};

const CustomToolbar = () => (
    <div id="global-quill-toolbar" className="ql-toolbar ql-snow flex flex-wrap items-center gap-2 border-b border-border bg-slate-50/50 px-4 py-2 w-full !border-0 border-b">
        <span className="ql-formats">
            <select className="ql-header" defaultValue="normal">
                <option value="normal">Normal</option>
                <option value="1">Heading 1</option>
                <option value="2">Heading 2</option>
            </select>
        </span>
        <span className="ql-formats">
            <button className="ql-list" value="ordered"></button>
            <button className="ql-list" value="bullet"></button>
            <button className="ql-indent" value="-1"></button>
            <button className="ql-indent" value="+1"></button>
        </span>
        <span className="ql-formats">
            <button className="ql-clean"></button>
        </span>
    </div>
);

const QUILL_MODULES = {
    toolbar: {
        container: '#global-quill-toolbar'
    }
};

interface PurchaseOrderCreatorProps {
    onBack: () => void;
    existingPO?: PurchaseOrder | null;
}

const PurchaseOrderCreator: React.FC<PurchaseOrderCreatorProps> = ({ onBack, existingPO }) => {
    const { vendors } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
        po_number: '',
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: '',
        payment_term: '',
        vendor_id: '',
        ship_to_address: 'Limperial Co., Ltd.\nNo. 123, St. 456, Phnom Penh, Cambodia',
        ordered_by_name: currentUser?.Name || '',
        ordered_by_phone: currentUser?.['Phone 1'] || '',
        currency: 'USD',
        tax_type: 'VAT',
        status: 'Draft',
        remarks: '',
        prepared_by: currentUser?.Name || '',
        prepared_by_position: currentUser?.Role || '',
        approved_by: '',
        approved_by_position: 'Manager',
    });

    const [items, setItems] = useState<PurchaseOrderItem[]>([
        { line_number: 1, item_number: '', description: '', qty: 1, unit_price: 0 }
    ]);

    const [isSaving, setIsSaving] = useState(false);

    // PDF Configuration State
    const [pdfLayout, setPdfLayout] = useState<PDFLayoutConfig>(defaultLayoutConfig);
    const [showPdfConfig, setShowPdfConfig] = useState(false);
    const [showLayoutControls, setShowLayoutControls] = useState(false);
    const [showFormPanel, setShowFormPanel] = useState(true);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'header' | 'table' | 'footer'>('header');
    const [hoveredPath, setHoveredPath] = useState<string | null>(null);

    const updateLayout = (path: string, value: any) => {
        setPdfLayout(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            const setVal = (obj: any, p: string, v: any) => {
                const k = p.split('.');
                let c = obj;
                for (let i = 0; i < k.length - 1; i++) c = c[k[i]];
                c[k[k.length - 1]] = v;
            };
            setVal(next, path, value);

            if (path === 'header.companyName.x') {
                const newX = Number(value);
                setVal(next, 'header.contactInfo.x', newX);
                setVal(next, 'header.address.x', newX);
            }
            if (path === 'header.companyName.y') {
                const oldY = prev.header.companyName.y;
                const newY = Number(value);
                const delta = newY - oldY;

                setVal(next, 'header.contactInfo.y', prev.header.contactInfo.y + delta);
                setVal(next, 'header.address.y', prev.header.address.y + delta);
                setVal(next, 'header.separatorLine.y', prev.header.separatorLine.y + delta);
                setVal(next, 'title.y', prev.title.y + delta);
            }

            localStorage.setItem('global_pdf_layout', JSON.stringify(next));
            return next;
        });
    };

    useEffect(() => {
        const loadGlobalLayout = async () => {
            const dbLayout = await getSetting('global_pdf_layout');
            if (dbLayout && typeof dbLayout === 'object' && Object.keys(dbLayout).length > 0) {
                setPdfLayout(dbLayout);
                return;
            }
            const savedLayout = localStorage.getItem('global_pdf_layout');
            if (savedLayout) {
                try {
                    const parsed = JSON.parse(savedLayout);
                    if (parsed && typeof parsed === 'object') {
                        setPdfLayout(parsed);
                    }
                } catch (e) { }
            }
        };
        loadGlobalLayout();
    }, []);

    const handleSaveLayout = async () => {
        try {
            await saveSetting('global_pdf_layout', pdfLayout);
            addToast('Layout saved as global default!', 'success');
        } catch (e: any) {
            addToast(`Failed to save layout: ${e.message}`, 'error');
        }
    };

    const totals = useMemo(() => {
        const sub_total = items.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);
        const isVAT = formData.tax_type === 'VAT';
        const vat_amount = isVAT ? sub_total * 0.1 : 0; // 10% VAT
        const grand_total = sub_total + vat_amount;
        return { sub_total, vat_amount, grand_total };
    }, [items, formData.tax_type]);

    useEffect(() => {
        const updatePreview = async () => {
            const selectedVendor = vendors?.find(v => v.id === formData.vendor_id);
            const previewUrl = await generatePDF({
                title: 'PURCHASE ORDER',
                headerData: {
                    ...formData,
                    'Vendor Name': formData.vendor_name || selectedVendor?.vendor_name,
                    'Vendor Address': formData.vendor_address || selectedVendor?.address,
                    'Vendor Contact': formData.vendor_contact || '',
                    'Vendor Phone': formData.vendor_phone || selectedVendor?.phone,
                    'Vendor Email': formData.vendor_email || selectedVendor?.email,
                    'PO Number': formData.po_number,
                    'Order Date': formData.order_date,
                    'Delivery Date': formData.delivery_date,
                    'Payment Term': formData.payment_term,
                    'Ship To': formData.ship_to_address,
                    'Currency': formData.currency,
                    'Prepared By': formData.prepared_by,
                    'Prepared By Position': formData.prepared_by_position,
                    'Approved By': formData.approved_by,
                    'Approved By Position': formData.approved_by_position
                },
                items: items.map(item => ({
                    no: item.line_number,
                    itemCode: item.item_number,
                    description: STRIP_HTML(item.description),
                    qty: item.qty,
                    unitPrice: item.unit_price,
                    amount: item.qty * item.unit_price
                })),
                totals: {
                    subTotal: totals.sub_total || 0,
                    vat: totals.vat_amount || 0,
                    grandTotal: totals.grand_total || 0
                },
                currency: (formData.currency as 'USD' | 'KHR') || 'USD',
                filename: 'preview.pdf',
                type: 'Purchase Order',
                layout: pdfLayout,
                previewMode: true
            });
            if (previewUrl) {
                setPdfPreviewUrl(previewUrl as string);
            }
        };

        const timer = setTimeout(updatePreview, 500);
        return () => clearTimeout(timer);
    }, [formData, items, totals, pdfLayout, vendors]);

    useEffect(() => {
        if (existingPO) {
            setFormData({
                ...existingPO,
                order_date: formatToInputDate(existingPO.order_date),
                delivery_date: formatToInputDate(existingPO.delivery_date)
            });
            loadPOItems(existingPO.id!);
        } else {
            generatePONumber();
        }
    }, [existingPO]);

    const generatePONumber = async () => {
        const dateStr = new Date().getFullYear().toString();
        const { data } = await supabase
            .from('purchase_orders')
            .select('po_number')
            .order('created_at', { ascending: false })
            .limit(1);

        let nextNumber = 1;
        if (data && data.length > 0) {
            const lastPO = data[0].po_number;
            const lastNumber = parseInt(lastPO.split('-').pop() || '0');
            nextNumber = lastNumber + 1;
        }

        setFormData(prev => ({ ...prev, po_number: `PO-${dateStr}-${String(nextNumber).padStart(3, '0')}` }));
    };

    const loadPOItems = async (poId: string) => {
        const { data, error } = await supabase
            .from('purchase_order_items')
            .select('*')
            .eq('po_id', poId)
            .order('line_number', { ascending: true });

        if (data) {
            setItems(data);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Auto-fill vendor info if vendor_id changes
        if (name === 'vendor_id' && vendors) {
            const vendor = vendors.find(v => v.id === value);
            if (vendor) {
                setFormData(prev => ({
                    ...prev,
                    vendor_id: value,
                    vendor_name: vendor.vendor_name,
                    vendor_address: vendor.address || '',
                    vendor_contact: vendor.contact_person || '',
                    vendor_phone: vendor.phone || '',
                    vendor_email: vendor.email || '',
                    payment_term: vendor.payment_terms || prev.payment_term
                }));
            }
        }
    };

    const handleItemChange = (index: number, field: keyof PurchaseOrderItem, value: any) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const addItem = () => {
        setItems(prev => [...prev, { line_number: prev.length + 1, item_number: '', description: '', qty: 1, unit_price: 0 }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, line_number: i + 1 })));
        }
    };

    const handleSave = async () => {
        if (!formData.vendor_id) {
            addToast('Please select a vendor', 'error');
            return;
        }

        setIsSaving(true);
        try {
            // Clean up payload by removing fields that shouldn't be in the update/insert object
            const { items: _, id: __, created_at: ___, updated_at: ____, ...cleanFormData } = formData as any;

            const poPayload = {
                ...cleanFormData,
                ...totals,
                // Ensure dates and UUIDs are sent as null if empty to avoid Postgres errors
                order_date: cleanFormData.order_date || null,
                delivery_date: cleanFormData.delivery_date || null,
                vendor_id: cleanFormData.vendor_id || null,
                created_by: cleanFormData.created_by || currentUser?.Name || 'System',
                updated_at: new Date().toISOString()
            };

            let poId = formData.id;

            if (poId) {
                const { error } = await supabase.from('purchase_orders').update(poPayload).eq('id', poId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('purchase_orders').insert([poPayload]).select();
                if (error) throw error;
                poId = data[0].id;
            }

            // Upsert Items
            // For simplicity, delete and re-insert items for existing POs
            if (formData.id) {
                await supabase.from('purchase_order_items').delete().eq('po_id', poId);
            }

            const itemsPayload = items.map(item => ({
                po_id: poId,
                line_number: item.line_number,
                item_number: item.item_number,
                description: item.description,
                qty: item.qty,
                unit_price: item.unit_price
            }));

            const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsPayload);
            if (itemsError) throw itemsError;

            // If PO is Completed, push items to vendor_pricelist
            if (formData.status === 'Completed') {
                try {
                    const pricelistPayload = items
                        .filter(item => item.item_number || item.description)
                        .map(item => ({
                            vendor_id: formData.vendor_id,
                            brand: '', // To be added by user later
                            model_name: item.item_number || STRIP_HTML(item.description).substring(0, 50) || 'N/A',
                            specification: STRIP_HTML(item.description),
                            dealer_price: item.unit_price,
                            currency: formData.currency || 'USD',
                            status: 'Available' as const,
                            created_by: currentUser?.Name || 'System'
                        }));

                    if (pricelistPayload.length > 0) {
                        const { error: priceError } = await supabase.from('vendor_pricelist').insert(pricelistPayload);
                        if (priceError) throw priceError;
                        addToast('Items automatically added to Vendor Pricelist!', 'success');
                    }
                } catch (pe: any) {
                    console.error("Pricelist sync error:", pe);
                    addToast(`PO saved, but pricelist sync failed: ${pe.message}`, 'info');
                }
            }

            addToast('Purchase Order saved successfully!', 'success');
            onBack();
        } catch (err: any) {
            addToast(`Error saving PO: ${err.message}`, 'error');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const selectedVendor = vendors?.find(v => v.id === formData.vendor_id);
            await generatePDF({
                title: 'PURCHASE ORDER',
                headerData: {
                    ...formData,
                    'Vendor Name': formData.vendor_name || selectedVendor?.vendor_name,
                    'Vendor Address': formData.vendor_address || selectedVendor?.address,
                    'Vendor Contact': formData.vendor_contact || '',
                    'Vendor Phone': formData.vendor_phone || selectedVendor?.phone,
                    'Vendor Email': formData.vendor_email || selectedVendor?.email,
                    'PO Number': formData.po_number,
                    'Order Date': formData.order_date,
                    'Delivery Date': formData.delivery_date,
                    'Payment Term': formData.payment_term,
                    'Ship To': formData.ship_to_address,
                    'Currency': formData.currency,
                    'Prepared By': formData.prepared_by,
                    'Prepared By Position': formData.prepared_by_position,
                    'Approved By': formData.approved_by,
                    'Approved By Position': formData.approved_by_position
                },
                items: items.map(item => ({
                    no: item.line_number,
                    itemCode: item.item_number,
                    description: STRIP_HTML(item.description),
                    qty: item.qty,
                    unitPrice: item.unit_price,
                    amount: item.qty * item.unit_price
                })),
                totals: {
                    subTotal: totals.sub_total || 0,
                    vat: totals.vat_amount || 0,
                    grandTotal: totals.grand_total || 0
                },
                currency: (formData.currency as 'USD' | 'KHR') || 'USD',
                filename: `${formData.po_number || 'PO'}.pdf`,
                type: 'Purchase Order',
                layout: pdfLayout
            });
        } catch (error: any) {
            console.error("PDF Download Error", error);
            addToast(`Error downloading PDF: ${error.message}`, 'error');
        }
    };

    const headerLeft = (
        <div className="flex items-center gap-4 min-w-max">
            <h2 className="text-xl font-bold truncate pr-4">{existingPO ? `Edit Purchase Order: ${existingPO.po_number}` : 'New Purchase Order'}</h2>
        </div>
    );

    const headerRight = (
        <div className="flex items-center gap-3 ml-4 min-w-max">
            <button
                type="button"
                onClick={() => setShowPdfPreview(!showPdfPreview)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition text-sm font-semibold shrink-0 shadow-sm ${showPdfPreview ? 'bg-brand-500/10 text-brand-600 border-brand-500/30' : 'bg-card text-muted-foreground hover:text-foreground border-border'}`}
            >
                <PanelRight className="w-4 h-4" /> {showPdfPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
            <button
                type="button"
                onClick={() => setShowLayoutControls(!showLayoutControls)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition text-sm font-semibold shrink-0 shadow-sm ${showLayoutControls ? 'bg-brand-500/10 text-brand-600 border-brand-500/30' : 'bg-card text-muted-foreground hover:text-foreground border-border'}`}
            >
                <SlidersHorizontal className="w-4 h-4" /> {showLayoutControls ? 'Hide Layout' : 'Layout Controls'}
            </button>
            <button
                type="button"
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 border border-brand-500/30 rounded-lg hover:bg-brand-500/10 transition text-sm font-semibold shrink-0 bg-card text-brand-600 shadow-sm"
            >
                <Download className="w-4 h-4" /> Download PDF
            </button>
            <button onClick={handleSave} disabled={isSaving} className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-8 rounded-lg transition-all duration-200 shadow-lg shadow-brand-500/20 min-w-[100px] flex items-center justify-center text-sm hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save</>}
            </button>
        </div>
    );

    return (
        <DocumentEditorContainer
            title=""
            onBack={onBack}
            onSave={handleSave}
            isSubmitting={isSaving}
            saveButtonText="Save PO"
            leftActions={headerLeft}
            rightActions={headerRight}
        >
            <div className="h-full flex relative overflow-hidden screen-only">
                {/* PDF Area */}
                <div className={`flex-1 flex flex-col relative overflow-hidden ${(!showPdfPreview && !showLayoutControls) ? 'hidden' : ''}`}>
                    {/* Top: Collapsible Layout Controls with Horizontal Tabs */}
                    <div className={`w-full border-b border-border flex flex-col bg-card transition-all duration-300 ease-in-out flex-shrink-0 ${showLayoutControls ? 'h-[320px] opacity-100' : 'h-0 opacity-0 overflow-hidden'}`}>
                        <div className="flex px-4 items-center justify-between border-b border-border bg-muted/30 h-10">
                            <div className="flex gap-1 h-full items-center">
                                {[
                                    { id: 'header', label: 'Header', activeColor: 'bg-blue-500', textColor: 'text-blue-600' },
                                    { id: 'table', label: 'Table', activeColor: 'bg-emerald-500', textColor: 'text-emerald-600' },
                                    { id: 'footer', label: 'Footer', activeColor: 'bg-purple-500', textColor: 'text-purple-600' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-4 h-7 rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-2 ${activeTab === tab.id
                                            ? `bg-background ${tab.textColor} shadow-sm border border-border`
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                            }`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${activeTab === tab.id ? tab.activeColor : 'bg-muted-foreground/30'}`} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {activeTab === 'header' && (
                                <div className="space-y-4">
                                    <div className="space-y-3 pb-4 border-b border-border">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Logo & Company Name</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <PDFControlField
                                                label="Logo Size"
                                                layout={pdfLayout}
                                                onUpdate={updateLayout}
                                                min={10} max={100}
                                                onHover={setHoveredPath} hoveredPath={hoveredPath} path="header.logo.width"
                                            />
                                            <PDFControlField
                                                label="Title Font Size"
                                                layout={pdfLayout}
                                                onUpdate={updateLayout}
                                                min={8} max={24}
                                                onHover={setHoveredPath} hoveredPath={hoveredPath} path="title.fontSize"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                            <PDFControlField
                                                label="Header Content Left/Right"
                                                layout={pdfLayout}
                                                onUpdate={updateLayout}
                                                min={10} max={100}
                                                onHover={setHoveredPath} hoveredPath={hoveredPath} path="header.companyName.x"
                                            />
                                            <PDFControlField
                                                label="Header Content Up/Down"
                                                layout={pdfLayout}
                                                onUpdate={updateLayout}
                                                min={0} max={50}
                                                onHover={setHoveredPath} hoveredPath={hoveredPath} path="header.companyName.y"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3 pb-4 border-b border-border">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document Information Grid</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <PDFControlField
                                                label="Grid Y Position"
                                                layout={pdfLayout}
                                                onUpdate={updateLayout}
                                                min={10} max={100}
                                                onHover={setHoveredPath} hoveredPath={hoveredPath} path="info.startY"
                                            />
                                            <PDFControlField
                                                label="Grid Font Size"
                                                layout={pdfLayout}
                                                onUpdate={updateLayout}
                                                min={6} max={14}
                                                onHover={setHoveredPath} hoveredPath={hoveredPath} path="info.fontSize"
                                            />
                                            <PDFControlField
                                                label="Row Height"
                                                layout={pdfLayout}
                                                onUpdate={updateLayout}
                                                min={4} max={15} step={0.5}
                                                onHover={setHoveredPath} hoveredPath={hoveredPath} path="info.rowHeight"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'table' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <PDFControlField
                                            label="Table Start Position (Y)"
                                            layout={pdfLayout}
                                            onUpdate={updateLayout}
                                            min={30} max={150}
                                            onHover={setHoveredPath} hoveredPath={hoveredPath} path="table.startY"
                                        />
                                        <PDFControlField
                                            label="Base Font Size"
                                            layout={pdfLayout}
                                            onUpdate={updateLayout}
                                            min={6} max={14}
                                            onHover={setHoveredPath} hoveredPath={hoveredPath} path="table.fontSize"
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'footer' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <PDFControlField
                                            label="Footer Y Position"
                                            layout={pdfLayout}
                                            onUpdate={updateLayout}
                                            min={100} max={280}
                                            onHover={setHoveredPath} hoveredPath={hoveredPath} path="footer.y"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 flex justify-end gap-2 p-2 bg-muted/30 rounded-lg">
                                <button
                                    onClick={handleSaveLayout}
                                    className="px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded hover:bg-slate-700 transition"
                                >
                                    Save as Default Layout
                                </button>
                                <button
                                    onClick={() => {
                                        setPdfLayout(defaultLayoutConfig);
                                        localStorage.setItem('global_pdf_layout', JSON.stringify(defaultLayoutConfig));
                                    }}
                                    className="px-3 py-1.5 bg-rose-100 text-rose-700 text-xs font-semibold rounded hover:bg-rose-200 transition"
                                >
                                    Reset Settings
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Center: PDF Preview */}
                    <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">PDF Layout Preview</h3>
                                    <p className="text-[10px] text-muted-foreground">{formData.po_number || 'PO-0000000'} • {vendors?.find(v => v.id === formData.vendor_id)?.vendor_name || 'No Vendor'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-xs text-muted-foreground font-medium px-2">Real-time Preview</div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 relative overflow-hidden p-6">
                            {pdfPreviewUrl ? (
                                <iframe
                                    src={pdfPreviewUrl}
                                    className="w-full h-full border-none shadow-lg rounded-lg bg-white"
                                    title="PDF Preview"
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                    <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                                    <span>Generating Preview...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Form Area */}
                <div className={`flex flex-col relative bg-background transition-all duration-300 ease-in-out ${(!showPdfPreview && !showLayoutControls) ? 'w-full' : (showFormPanel ? 'w-full lg:w-[600px] 2xl:w-[700px] border-l border-border' : 'w-0 opacity-0 overflow-hidden border-none')}`}>
                    <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                            {/* Vendor & Details Section */}
                            <FormSection title="Vendor Information">
                                <div className="flex flex-col md:col-span-2 mb-2">
                                    <label className="text-sm font-medium text-foreground mb-1.5">Load from Database</label>
                                    <select
                                        name="vendor_id"
                                        value={formData.vendor_id}
                                        onChange={handleInputChange}
                                        className="block w-full px-3.5 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:bg-background focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150"
                                    >
                                        <option value="">Select Vendor to auto-fill...</option>
                                        {vendors?.map(v => (
                                            <option key={v.id} value={v.id}>{v.vendor_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <FormInput name="vendor_name" label="Vendor Name" value={formData.vendor_name || ''} onChange={handleInputChange} required />
                                <FormInput name="vendor_contact" label="Contact Name" value={formData.vendor_contact || ''} onChange={handleInputChange} />
                                <FormInput name="vendor_phone" label="Phone Number" value={formData.vendor_phone || ''} onChange={handleInputChange} />
                                <FormInput name="vendor_email" label="Email Address" value={formData.vendor_email || ''} onChange={handleInputChange} type="email" />
                                <div className="md:col-span-2 mt-2">
                                    <FormTextarea name="vendor_address" label="Vendor Address" value={formData.vendor_address || ''} onChange={handleInputChange} rows={2} />
                                </div>
                            </FormSection>

                            <FormSection title="Order Details">
                                <FormInput name="po_number" label="PO Number #" value={formData.po_number || ''} onChange={handleInputChange} readOnly />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormSelect
                                        name="status"
                                        label="Status"
                                        value={formData.status || 'Draft'}
                                        onChange={handleInputChange}
                                        options={['Draft', 'Approved', 'Sent', 'Completed', 'Cancelled']}
                                    />
                                    <FormSelect
                                        name="tax_type"
                                        label="Tax Type"
                                        value={formData.tax_type || 'VAT'}
                                        onChange={handleInputChange}
                                        options={['VAT', 'NON-VAT']}
                                    />
                                </div>
                                <FormInput name="order_date" label="Order Date" value={formData.order_date || ''} onChange={handleInputChange} type="date" />
                                <FormInput name="delivery_date" label="Delivery Date" value={formData.delivery_date || ''} onChange={handleInputChange} type="date" />
                                <FormInput name="payment_term" label="Payment Term" value={formData.payment_term || ''} onChange={handleInputChange} placeholder="e.g. Net 30" />
                                <FormInput name="ordered_by_name" label="Order By Name" value={formData.ordered_by_name || ''} onChange={handleInputChange} />
                                <FormInput name="ordered_by_phone" label="Order By Phone" value={formData.ordered_by_phone || ''} onChange={handleInputChange} />
                                <div className="md:col-span-2 mt-2">
                                    <FormTextarea name="ship_to_address" label="Ship To Address" value={formData.ship_to_address || ''} onChange={handleInputChange} rows={2} />
                                </div>
                            </FormSection>
                        </div>

                        {/* Line Items Section */}
                        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                            <div className="bg-muted/30 px-4 py-3 border-b border-border flex justify-between items-center">
                                <h3 className="font-bold flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-brand-500" /> Line Items</h3>
                                <button onClick={addItem} className="text-sm font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1 transition">
                                    <Plus className="w-4 h-4" /> Add Item
                                </button>
                            </div>
                            {/* Global Sticky Toolbar */}
                            <div className="border-b border-border sticky top-0 z-10 w-full overflow-x-auto bg-slate-50 [&_.ql-toolbar]:border-none [&_.ql-toolbar]:!px-2 [&_.ql-toolbar]:!py-1.5 [&_.ql-toolbar]:w-full [&_.ql-picker]:font-sans">
                                <CustomToolbar />
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                    <thead>
                                        <tr className="bg-muted/20 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                                            <th className="px-4 py-3 w-16">No.</th>
                                            <th className="px-4 py-3 w-32">Item #</th>
                                            <th className="px-4 py-3 min-w-[200px]">Description</th>
                                            <th className="px-4 py-3 w-20">Qty</th>
                                            <th className="px-4 py-3 w-28">Unit Price</th>
                                            <th className="px-4 py-3 w-28">Total</th>
                                            <th className="px-4 py-3 w-12 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, index) => (
                                            <tr key={index} className="border-b border-border/50 hover:bg-muted/5 transition-colors">
                                                <td className="px-4 py-3 text-sm text-muted-foreground">{item.line_number}</td>
                                                <td className="px-2 py-3">
                                                    <input
                                                        className="w-full bg-transparent border-b border-transparent focus:border-brand-500 py-1.5 focus:outline-none transition text-sm"
                                                        value={item.item_number}
                                                        onChange={(e) => handleItemChange(index, 'item_number', e.target.value)}
                                                        placeholder="SKU"
                                                    />
                                                </td>
                                                <td className="px-2 py-3 min-w-[300px]">
                                                    <div className="bg-white rounded border border-border/50 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all shadow-sm overflow-hidden" style={{ minHeight: '60px' }}>
                                                        <ReactQuill
                                                            theme="snow"
                                                            value={item.description}
                                                            onChange={(val) => handleItemChange(index, 'description', val)}
                                                            modules={QUILL_MODULES}
                                                            placeholder="Add detailed description..."
                                                            className="h-full border-none [&_.ql-toolbar]:hidden [&_.ql-container]:border-none [&_.ql-editor]:min-h-[50px] [&_.ql-editor]:text-sm [&_.ql-editor]:px-3 [&_.ql-editor]:py-2"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-2 py-3">
                                                    <input
                                                        className="w-full bg-transparent border-b border-transparent focus:border-brand-500 py-1.5 focus:outline-none transition text-sm text-center"
                                                        type="number"
                                                        value={item.qty}
                                                        onChange={(e) => handleItemChange(index, 'qty', parseFloat(e.target.value) || 0)}
                                                    />
                                                </td>
                                                <td className="px-2 py-3">
                                                    <input
                                                        className="w-full bg-transparent border-b border-transparent focus:border-brand-500 py-1.5 focus:outline-none transition text-sm text-right"
                                                        type="number"
                                                        step="0.01"
                                                        value={item.unit_price}
                                                        onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold text-right">
                                                    {formatCurrencySmartly(item.qty * item.unit_price, formData.currency)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => removeItem(index)} className="text-muted-foreground hover:text-rose-500 transition">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-muted/10 p-6 flex flex-col justify-end items-end gap-6">
                                <div className="w-full border-t border-border pt-4">
                                    <div className="flex justify-between text-sm py-1">
                                        <span className="text-muted-foreground font-medium">Sub Total:</span>
                                        <span className="font-semibold">{formatCurrencySmartly(totals.sub_total, formData.currency)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm py-1">
                                        <span className="text-muted-foreground font-medium">{formData.tax_type === 'VAT' ? 'VAT (10%):' : 'Tax (0%):'}</span>
                                        <span className="font-semibold text-rose-600">{formatCurrencySmartly(totals.vat_amount, formData.currency)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg py-3 border-t border-border mt-2">
                                        <span className="font-bold text-foreground">Grand Total:</span>
                                        <span className="font-bold text-brand-600">{formatCurrencySmartly(totals.grand_total, formData.currency)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Signature Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                            <FormSection title="Preparation">
                                <div className="grid grid-cols-1 gap-4">
                                    <FormInput name="prepared_by" label="Prepared By" value={formData.prepared_by} onChange={handleInputChange} />
                                    <FormInput name="prepared_by_position" label="Position" value={formData.prepared_by_position} onChange={handleInputChange} />
                                </div>
                            </FormSection>
                            <FormSection title="Approval">
                                <div className="grid grid-cols-1 gap-4">
                                    <FormInput name="approved_by" label="Approved By" value={formData.approved_by} onChange={handleInputChange} />
                                    <FormInput name="approved_by_position" label="Position" value={formData.approved_by_position} onChange={handleInputChange} />
                                </div>
                            </FormSection>
                        </div>
                    </div>
                </div>
            </div>
        </DocumentEditorContainer>
    );
};

export default PurchaseOrderCreator;

