// Import React to resolve 'Cannot find namespace 'React'' error.
import React from 'react';

export interface Metric {
  title: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease';
  onClick?: () => void;
  icon?: React.ReactNode;
}

export interface ProjectStatusData {
  name: string;
  value: number;
  // Add index signature for compatibility with Recharts data prop type.
  [key: string]: any;
}

export interface Activity {
  id: number;
  user: {
    name: string;
    avatar: string;
  };
  action: string;
  target: string;
  time: string;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  avatar: string;
}

export interface User {
  UserID: string;
  Name: string;
  Role: string;
  Picture: string;
  Password?: string;
  Email?: string;
  Status?: 'Active' | 'Inactive';
  'Phone 1'?: string;
  'Phone 2'?: string;
}

export interface PipelineProject {
  'Pipeline No.': string;
  'Company Name': string;
  'Contact Name': string;
  'Contact Number': string;
  'Email': string;
  'Require': string;
  'Type': string;
  'Brand 1': string;
  'Taxable': 'VAT' | 'NON-VAT';
  'Responsible By': string;
  'Status': 'Qualification' | 'Price Request' | 'Presentation' | 'Quote Submitted' | 'Revising Specs' | 'Bid Evaluation' | 'Pass Evaluation' | 'Pending PO' | 'Ordering' | 'Close (win)' | 'Close (lose)';
  'Created Date': string;
  'Time Frame': string;
  'Due Date': string;
  'Inv Date': string;
  'Quote': string;
  'Quote No.'?: string;
  'Bid Value': string;
  'Invoice No.': string;
  'SO No.'?: string;
  'Remarks': string;
  'Conditional': string;
  'Currency'?: 'USD' | 'KHR';
}

export interface Company {
  'Company ID': string;
  'Created Date': string;
  'Created By': string;
  'Company Name': string;
  'Company Name (Khmer)': string;
  'Phone Number': string;
  'Patent': string;
  'Payment Term': string;
  'Field': string;
  'Address (English)': string;
  'Address (Khmer)': string;
  'Email': string;
  'Website': string;
  'Patent File': string;
  [key: string]: any; // Index signature for dynamic property access
}

export interface Contact {
  'Customer ID': string;
  'Created Date': string;
  'Company Name': string;
  'Name': string;
  'Name (Khmer)': string;
  'Role': string;
  'Department': string;
  'Tel (1)': string;
  'Tel (2)': string;
  'Email': string;
  'Address (English)': string;
  'Address (Khmer)': string;
  'Created By': string;
  'Remarks': string;
  [key: string]: any; // Index signature for dynamic property access
}

export interface ContactLog {
  'Log ID'?: string;
  'Type': string;
  'Company Name': string;
  'Contact Name': string;
  'Position': string;
  'Phone Number': string;
  'Email': string;
  'Responsible By': string;
  'Contact Date': string;
  'Counter': string;
  'Remarks': string;
  [key: string]: any;
}

export interface SiteSurveyLog {
  'Site ID'?: string;
  'Location': string;
  'Responsible By': string;
  'Date': string;
  'Start Time': string;
  'End Time': string;
  'Remark': string;
  'Next Action (If Any)': string;
  [key: string]: any;
}

export interface Meeting {
  'Meeting ID'?: string;
  'Type': string;
  'Pipeline_ID': string;
  'Company Name': string;
  'Participants': string;
  'Responsible By': string;
  'Meeting Date': string;
  'Start Time': string;
  'End Time': string;
  'Status': string;
  'Remarks': string;
  [key: string]: any;
}

export interface UnifiedActivity {
  type: 'meeting' | 'log';
  date: Date;
  isoDate: string;
  responsible: string;
  summary: string;
  details: string;
  original: Meeting | ContactLog;
}



export interface PendingWorkItem {
  id: string;
  type: 'quotation' | 'saleOrder' | 'pipeline' | 'invoice' | 'meeting' | 'survey' | 'contactLog';
  title: string;
  subtitle: string;
  dueDate: Date;
  date: string;
  time: string;
  status: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  daysUntil: number;
  icon: React.ReactNode;
  link: string;
}

export interface Notification {
  id: string;
  type: 'quotation' | 'sale_order' | 'project' | 'invoice' | 'meeting' | 'site_survey';
  subtype: 'expiry' | 'delivery' | 'due_date' | 'stuck' | 'upcoming';
  title: string;
  description: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
  link: {
    view: string;
    filter: string;
  };
  read?: boolean;
}

export interface Quotation {
  'Quote No.': string;
  'File': string;
  'Quote Date': string;
  'Validity Date'?: string;
  'Company Name': string;
  'Company Address'?: string;
  'Contact Name': string;
  'Contact Number': string;
  'Contact Email'?: string;
  'Amount': string;
  'CM'?: string;
  'Status': 'Open' | 'Close (Win)' | 'Close (Lose)' | 'Cancel';
  'Reason'?: string;
  'Payment Term'?: string;
  'Stock Status'?: string;
  'Created By'?: string;
  'Currency'?: 'USD' | 'KHR';
  'Prepared By'?: string;
  'Approved By'?: string;
  'Remark'?: string;
  'Terms and Conditions'?: string;
  'Prepared By Position'?: string;
  'Approved By Position'?: string;
  'ItemsJSON'?: any;
  'Tax Type'?: 'VAT' | 'NON-VAT';
  [key: string]: any;
}

export interface SaleOrder {
  'SO No.': string;
  'SO Date': string;
  'File': string;
  'Quote No.': string;
  'Company Name': string;
  'Contact Name': string;
  'Phone Number': string;
  'Email': string;
  'Tax': string;
  'Total Amount': string;
  'Commission': string;
  'Status': 'Pending' | 'Completed' | 'Cancel';
  'Delivery Date'?: string;
  'Payment Term'?: string;
  'Bill Invoice'?: 'VAT' | 'NON-VAT';
  'Install Software'?: string;
  'Created By'?: string;
  'Currency'?: 'USD' | 'KHR';
  'Attachment'?: string;
  'Company Address'?: string;
  'Prepared By'?: string;
  'Approved By'?: string;
  'Prepared By Position'?: string;
  'Approved By Position'?: string;
  'Remark'?: string;
  'Terms and Conditions'?: string;
  'ItemsJSON'?: any;
  [key: string]: any;
}

export interface PricelistItem {
  'Code': string;
  'Brand': string;
  'Model': string;
  'Description': string;
  'End User Price': string;
  'Dealer Price': string;
  'Sheet Name': string;
  'Promotion': string;
  'Category': string;
  'Status': string;
  'Currency'?: 'USD' | 'KHR';
  [key: string]: any;
}

export interface Invoice {
  'Inv No.': string;
  'Inv Date': string;
  'File': string;
  'SO No.': string;
  'Company Name': string;
  'Contact Name': string;
  'Phone Number': string;
  'Email': string;
  'Amount': string;
  'Taxable': string;
  'Status': 'Draft' | 'Processing' | 'Completed' | 'Cancel';
  'Created By'?: string;
  'Currency'?: 'USD' | 'KHR';
  'Attachment'?: string;
  'Company Address'?: string;
  'Payment Term'?: string;
  'Tin No.'?: string;
  'ItemsJSON'?: any;
  [key: string]: any;
}