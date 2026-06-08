// Import React to resolve 'Cannot find namespace 'React'' error.
import React from 'react';

// ─── Permission System Types ──────────────────────────────────────────────────

/** Every action a user can be granted on a module */
export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'export'
  | 'send'
  | 'approve'
  | 'use';

/** Action flags for a single module */
export type ModulePermissions = Partial<Record<PermissionAction, boolean>>;

/**
 * Field-level visibility flags.
 * Controls whether sensitive data columns are rendered in tables/forms.
 */
export interface DataVisibility {
  /** "Dealer Price" column in B2C + B2B Pricelist */
  showDealerPrice?: boolean;
  /** dealer_price + user_price columns in Vendor Pricelist */
  showVendorPricing?: boolean;
  /** unit_price in Purchase Order items and Inventory */
  showPurchaseCosts?: boolean;
  /** Revenue/financial charts on Dashboard and Weekly Report */
  showRevenueData?: boolean;
}

/**
 * Full permission snapshot stored as JSONB in the users table.
 * null in the DB means "use role preset" — no custom overrides.
 */
export interface UserPermissions {
  modules: Record<string, ModulePermissions>;
  dataVisibility?: DataVisibility;
}

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
  [key: string]: any;
}

export interface Activity {
  id: number;
  user: { name: string; avatar: string };
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
  /**
   * Fine-grained permission snapshot (JSONB from Supabase).
   * null / undefined → resolved from ROLE_PRESETS[role] at runtime.
   */
  permissions?: UserPermissions | null;
}

export interface PipelineProject {
  'Pipeline No': string;
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
  'Quote No'?: string;
  'Bid Value': string | number;
  'Invoice No': string;
  'SO No'?: string;
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
  [key: string]: any;
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
  [key: string]: any;
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
  'Company Name'?: string;
  'Pipeline_ID'?: string;
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
  'Status': 'Open' | 'Close' | 'Cancelled';
  'Remarks': string;
  [key: string]: any;
}

export interface UnifiedActivity {
  type: 'meeting' | 'log' | 'survey';
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
  link: { view: string; filter: string };
  read?: boolean;
}

export interface Quotation {
  'Quote No': string;
  'File': string;
  'Quote Date': string;
  'Validity Date'?: string;
  'Company Name': string;
  'Company Address'?: string;
  'Contact Name': string;
  'Contact Number': string;
  'Contact Email'?: string;
  'Amount': string | number;
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
  'SO No': string;
  'SO Date': string;
  'File': string;
  'Quote No': string;
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

export interface Invoice {
  'Inv No': string;
  'Inv Date': string;
  'Due Date'?: string;
  'File': string;
  'SO No': string;
  'Company Name': string;
  'Company Name (Khmer)'?: string;
  'Contact Name': string;
  'Phone Number': string;
  'Email': string;
  'Amount': string | number;
  'Taxable': string;
  'Tax Type'?: 'VAT' | 'NON-VAT';
  'Status': 'Draft' | 'Processing' | 'Completed' | 'Cancel';
  'Created By'?: string;
  'Currency'?: 'USD' | 'KHR';
  'Attachment'?: string;
  'Company Address'?: string;
  'Payment Term'?: string;
  'Tin No'?: string;
  'Deposit'?: number;
  'Exchange Rate'?: string;
  'Prepared By'?: string;
  'Approved By'?: string;
  'Prepared By Position'?: string;
  'Approved By Position'?: string;
  'ItemsJSON'?: any;
  'created_at'?: string;
  'updated_at'?: string;
  [key: string]: any;
}

export interface DeliveryOrder {
  'DO No': string;
  'DO Date': string;
  'Inv No'?: string;
  'SO No'?: string;
  'Company Name': string;
  'Company Address'?: string;
  'Contact Name': string;
  'Phone Number': string;
  'Email'?: string;
  'Currency'?: 'USD' | 'KHR';
  'Status': 'Pending' | 'Delivered' | 'Cancelled';
  'Payment Term'?: string;
  'Delivery Date'?: string;
  'Prepared By'?: string;
  'Approved By'?: string;
  'Prepared By Position'?: string;
  'Approved By Position'?: string;
  'Remark'?: string;
  'Terms and Conditions'?: string;
  'File'?: string;
  'Created By'?: string;
  'ItemsJSON'?: any;
  'created_at'?: string;
  'updated_at'?: string;
  [key: string]: any;
}

export interface Receipt {
  'RV No': string;
  'RV Date': string;
  'Inv No'?: string;
  'SO No'?: string;
  'DO No'?: string;
  'Company Name': string;
  'Company Address'?: string;
  'Contact Name': string;
  'Phone Number': string;
  'Email'?: string;
  'Amount'?: number;
  'Currency'?: 'USD' | 'KHR';
  'Payment Method'?: 'Cash' | 'Bank Transfer' | 'Cheque' | 'ABA' | 'KHQR' | 'Other';
  'Tax Type'?: 'VAT' | 'NON-VAT';
  'Status': 'Draft' | 'Issued' | 'Cancelled';
  'Payment Term'?: string;
  'Tin No'?: string;
  'Prepared By'?: string;
  'Approved By'?: string;
  'Prepared By Position'?: string;
  'Approved By Position'?: string;
  'Remark'?: string;
  'Terms and Conditions'?: string;
  'File'?: string;
  'Created By'?: string;
  'ItemsJSON'?: any;
  'created_at'?: string;
  'updated_at'?: string;
  [key: string]: any;
}

export interface Vendor {
  id: string;
  vendor_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  payment_terms: string;
  tax_id: string;
  category: string;
  status: 'Active' | 'Inactive' | 'Blocked';
  remarks: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface VendorPricelistItem {
  id: string;
  vendor_id: string;
  brand: string;
  model_name: string;
  specification: string;
  dealer_price: number;
  user_price: number;
  promotion: string;
  currency: 'USD' | 'KHR';
  status: 'Available' | 'Discontinued' | 'Out of Stock';
  remarks: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  vendor_name?: string;
}

export interface PricelistItem {
  'Code': string;
  'Brand': string;
  'Model': string;
  'Description': string;
  'End User Price': string;
  'Dealer Price': string;
  'Category': string;
  'Series': string;
  'Status': 'Available' | 'Out of Stock' | 'Pre-order' | string;
  'Currency'?: 'USD' | 'KHR';
  'Promotion': string;
  'Qty': number | null;
  'image_url': any;
  'video_url': string;
  'extra_specs': any;
  'category_id': number | null;
  'subcategory_id': number | null;
  'updated_at': string;
  [key: string]: any;
}

export interface PurchaseOrderItem {
  id?: string;
  po_id?: string;
  line_number: number;
  item_number: string;
  description: string;
  qty: number;
  unit_price: number;
  total?: number;
  /** Populated from vendor/pricelist lookup — stored in DB after migration */
  brand?: string;
  category?: string;
}

/** Inventory item — converted from a Purchase Order, used to source Sale Orders */
export interface InventoryItem {
  id: string;
  po_id?: string;
  po_number?: string;
  vendor_id?: string;
  vendor_name?: string;
  category?: string;
  code?: string;
  brand?: string;
  model_name?: string;
  description?: string;
  qty: number;
  unit_price: number;
  currency?: 'USD' | 'KHR';
  /** In Stock | Reserved | Out of Stock */
  status?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface PurchaseOrder {
  id?: string;
  po_number: string;
  order_date: string;
  delivery_date?: string;
  payment_term?: string;
  vendor_id?: string;
  vendor_name?: string;
  vendor_address?: string;
  vendor_contact?: string;
  vendor_phone?: string;
  vendor_email?: string;
  ship_to_address?: string;
  ordered_by_name?: string;
  ordered_by_phone?: string;
  sub_total?: number;
  vat_amount?: number;
  grand_total?: number;
  currency?: 'USD' | 'KHR';
  status?: 'Draft' | 'Approved' | 'Sent' | 'Completed' | 'Cancelled';
  prepared_by?: string;
  approved_by?: string;
  prepared_by_position?: string;
  approved_by_position?: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  items?: PurchaseOrderItem[];
  [key: string]: any;
}

// ─── Accounting Module ────────────────────────────────────────────────────────

export interface ChartOfAccount {
  id: number;
  account_number: string;
  account_name: string;
  parent_account_number: string | null;
  account_type: string;
  description: string;
  is_hidden: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryLine {
  id?: string;
  journal_entry_id?: string;
  account_number: string;
  account_name?: string;
  description: string;
  debit: number;
  credit: number;
  created_at?: string;
}

export interface JournalEntry {
  id?: string;
  entry_number: string;
  entry_date: string;
  description: string;
  reference: string;
  created_by: string;
  is_posted: boolean;
  source?: string;
  posted_by?: string;
  posted_at?: string;
  lines?: JournalEntryLine[];
  total_debit?: number;
  total_credit?: number;
  created_at?: string;
  updated_at?: string;
}

/** Balance sheet line item with account + computed balance */
export interface BalanceSheetLine {
  account_number: string;
  account_name: string;
  parent_account_number: string | null;
  account_type: string;
  balance: number;
  is_parent: boolean;
}

// ─── Consignment Module ───────────────────────────────────────────────────────

export interface ConsignmentItem {
  id: string;
  consignment_id: string;
  item_no: number;
  item_code: string;
  product_name: string;
  brand: string;
  category: string;
  qty_sent: number;
  qty_returned: number;
  status: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface Consignment {
  id: string;
  voucher_no: string;
  transfer_date: string;
  from_location: string;
  to_location: string;
  status: string;
  received_by: string;
  received_date: string | null;
  notes: string;
  created_at?: string;
  updated_at?: string;
  items?: ConsignmentItem[];
}

// ─── Product Inquiries Module ─────────────────────────────────────────────────

export interface InquiryItem {
  id?: string;
  inquiry_id?: string;
  line_number: number;
  brand: string;
  model_name: string;
  specification: string;
  qty: number;
  target_price?: number | null;
  currency: 'USD' | 'KHR';
  stock_type: 'In-Stock' | 'Lead Time';
  item_status: 'Pending' | 'In Stock' | 'Available' | 'Lead Time' | 'Not Available';
  actual_price?: number | null;
  lead_time_days?: number | null;
  vendor_name: string;
  item_notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductInquiry {
  id?: string;
  inquiry_no: string;
  inquiry_date: string;
  company_name: string;
  contact_name: string;
  responsible_by: string;
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  status: 'Draft' | 'Pending' | 'In Progress' | 'Quoted' | 'Cancelled';
  remarks: string;
  procurement_notes: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  items?: InquiryItem[];
  [key: string]: any;
}
