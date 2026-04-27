import { createRoot } from 'react-dom/client';
import React from 'react';
import { SaleOrder, Quotation, Invoice, ContactLog, SiteSurveyLog } from '../types';
import PrintableWeeklyReport from '../components/pdf/PrintableWeeklyReport';

export function exportWeeklyReport(
    saleOrders: SaleOrder[],
    options: {
        preparedBy?: string;
        reportMonth?: string;
        weekStart?: Date;
        quotations?: Quotation[];
        invoices?: Invoice[];
        contactLogs?: ContactLog[];
        siteSurveys?: SiteSurveyLog[];
    } = {},
) {
    const { preparedBy = 'Sales Team', reportMonth = '', weekStart, quotations = [], invoices = [], contactLogs = [], siteSurveys = [] } = options;

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
        return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Weekly Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: white; font-family: 'Century Gothic', 'Calibri', sans-serif; }
    @media print {
      @page { size: A3 landscape; margin: 12mm; }
      body { margin: 0; padding: 0; }
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>`);
    printWindow.document.close();

    const container = printWindow.document.getElementById('root')!;
    const root = createRoot(container);

    root.render(
        React.createElement(PrintableWeeklyReport, {
            saleOrders,
            quotations,
            invoices,
            contactLogs,
            siteSurveys,
            preparedBy,
            reportMonth,
            weekStart,
        })
    );

    let printed = false;

    // Wait for React to render + images to load, then print
    printWindow.onload = () => {
        setTimeout(() => {
            if (printed) return;
            printed = true;
            printWindow.focus();
            printWindow.print();
        }, 800);
    };

    // Fallback if onload already fired
    setTimeout(() => {
        if (printed || printWindow.closed) return;
        printed = true;
        printWindow.focus();
        printWindow.print();
    }, 1200);
}
