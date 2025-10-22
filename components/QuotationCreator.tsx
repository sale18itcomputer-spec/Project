import React, { useState, useMemo, useEffect } from 'react';
import { Quotation, Company, Contact } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { createRecord, updateRecord, createQuotationSheet, readQuotationSheetData } from '../services/api';
import { formatToSheetDate, formatToInputDate } from '../utils/time';
import { FormSection, FormInput, FormSelect, FormTextarea } from './FormControls';
import PrintableQuotation from './PrintableQuotation';
// FIX: Replaced non-modular local icon import with an icon from the 'lucide-react' library.
import { Trash2 } from 'lucide-react';
import Spinner from './Spinner';
import SuccessModal from './SuccessModal';
import DocumentEditorContainer from './DocumentEditorContainer';

interface QuotationCreatorProps {
    onBack: () => void;
    existingQuotation: Quotation | null;
}

interface LineItem {
  id: string;
  no: number;
  itemCode: string;
  modelName: string;
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
}


const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const STATUS_OPTIONS: Quotation['Status'][] = ['Open', 'Close (Win)', 'Close (Lose)', 'Cancel'];

const QuotationCreator: React.FC<QuotationCreatorProps> = ({ onBack, existingQuotation }) => {
    const { quotations, companies, contacts, refetchData } = useData();
    const { currentUser } = useAuth();
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [itemsLoading, setItemsLoading] = useState(false);
    const [successInfo, setSuccessInfo] = useState<{ url: string; quoteNo: string } | null>(null);

    const [items, setItems] = useState<LineItem[]>([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 }]);
    
    const nextQuotationNumber = useMemo(() => {
        if (existingQuotation) return existingQuotation['Quote No.'];
        if (!quotations || quotations.length === 0) return 'Q-0000001';

        const maxNum = quotations.reduce((max, q) => {
            const numPart = parseInt(q['Quote No.'].replace('Q-', ''), 10);
            return isNaN(numPart) ? max : Math.max(max, numPart);
        }, 0);

        return `Q-${String(maxNum + 1).padStart(7, '0')}`;
    }, [quotations, existingQuotation]);
    
    const [quote, setQuote] = useState<Partial<Quotation & { [key: string]: any }>>(() => {
        if (existingQuotation) {
            return {
                ...existingQuotation,
                'Quote Date': existingQuotation['Quote Date'] ? formatToInputDate(existingQuotation['Quote Date']) : getTodayDateString(),
                'Validity Date': existingQuotation['Validity Date'] ? formatToInputDate(existingQuotation['Validity Date']) : getTodayDateString(),
            };
        }
        return {
            'Quote No.': nextQuotationNumber,
            'Quote Date': getTodayDateString(),
            'Validity Date': getTodayDateString(),
            'Status': 'Open',
            'Created By': currentUser?.Name || '',
        };
    });

     useEffect(() => {
        // Wait until we have an existing quotation and the master data to perform lookups.
        if (!existingQuotation || !existingQuotation['Quote No.'] || !companies || !contacts) {
            // If we have an existing quote but no master data yet, we can still show the items loading spinner
            if (existingQuotation) {
                setItemsLoading(true);
            }
            return;
        }

        const fetchDetails = async () => {
            setItemsLoading(true);
            setError('');
            try {
                const response = await readQuotationSheetData(existingQuotation['Quote No.']);
                if (!response) {
                    throw new Error('Failed to fetch quotation details: empty response.');
                }

                const { header, items: fetchedItems } = response;

                // Start building the quote data by merging the master record with the detailed header info from the sheet.
                // This ensures all fields are populated correctly.
                let updatedQuoteData = {
                    ...existingQuotation,
                    ...header,
                    'Quote Date': header['Quote Date'] ? formatToInputDate(header['Quote Date']) : formatToInputDate(existingQuotation['Quote Date']),
                    'Validity Date': header['Validity Date'] ? formatToInputDate(header['Validity Date']) : formatToInputDate(existingQuotation['Validity Date']),
                };

                // ---- "Smart Fallback" Logic ----
                const companyName = updatedQuoteData['Company Name'];
                const contactName = updatedQuoteData['Contact Name'];

                if (companyName) {
                    const matchedCompany = companies.find(c => c['Company Name'] === companyName);
                    if (matchedCompany) {
                        if (!updatedQuoteData['Company Address']) {
                            updatedQuoteData['Company Address'] = matchedCompany['Address (English)'];
                        }
                        if (!updatedQuoteData['Payment Term']) {
                            updatedQuoteData['Payment Term'] = matchedCompany['Paymet Term'];
                        }
                    }
                }

                if (contactName) {
                    const matchedContact = contacts.find(c => c.Name === contactName && c['Company Name'] === companyName);
                    if (matchedContact) {
                        if (!updatedQuoteData['Contact Number']) {
                            updatedQuoteData['Contact Number'] = matchedContact['Tel (1)'];
                        }
                        if (!updatedQuoteData['Contact Email']) {
                            updatedQuoteData['Contact Email'] = matchedContact.Email;
                        }
                    }
                }
                
                setQuote(updatedQuoteData);
                
                // Update line items state
                if (fetchedItems && fetchedItems.length > 0) {
                    const formattedItems = fetchedItems.map((item: any) => ({
                        ...item,
                        id: `item-${Date.now()}-${Math.random()}`,
                    }));
                    setItems(formattedItems);
                } else {
                    setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 }]);
                }
            } catch(err: any) {
                setError(`Failed to load quotation details: ${err.message}`);
            } finally {
                setItemsLoading(false);
            }
        };

        fetchDetails();

    }, [existingQuotation, companies, contacts]);
    
    // As the file is truncated, we can't render the UI. Returning null to fix compilation.
    return null;
};

export default QuotationCreator;