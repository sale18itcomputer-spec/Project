// Headers for Pipelines Sheet
export const PIPELINE_HEADERS = [
  'Pipeline No.',
  'Company Name',
  'Contact Name',
  'Contact Number',
  'Email',
  'Require',
  'Type',
  'Brand 1',
  'Taxable',
  'Responsible By',
  'Status',
  'Created Date',
  'Time Frame',
  'Due Date',
  'Inv Date',
  'Quote',
  'Quote No.',
  'Bid Value',
  'Invoice No.',
  'SO No.',
  'Remarks',
  'Conditional',
  'Currency'
] as const;

export const COMPACT_PIPELINE_HEADERS = [
  'Pipeline No.',
  'Company Name',
  'Status',
  'Responsible By',
  'Due Date',
  'Bid Value',
] as const;


// Headers for Companies Sheet
export const COMPANY_HEADERS = [
  'Company ID',
  'Created Date',
  'Created By',
  'Company Name',
  'Company Name (Khmer)',
  'Phone Number',
  'Patent',
  'Payment Term',
  'Field',
  'Address (English)',
  'Address (Khmer)',
  'Email',
  'Website',
  'Patent File'
] as const;

export const COMPACT_COMPANY_HEADERS = [
  'Company ID',
  'Company Name',
  'Phone Number',
  'Field',
  'Created Date'
] as const;

// Headers for Contact List Sheet
export const CONTACT_HEADERS = [
  'Customer ID',
  'Created Date',
  'Company Name',
  'Name',
  'Name (Khmer)',
  'Role',
  'Department',
  'Tel (1)',
  'Tel (2)',
  'Email',
  'Address (English)',
  'Address (Khmer)',
  'Created By',
  'Remarks'
] as const;

export const COMPACT_CONTACT_HEADERS = [
  'Customer ID',
  'Name',
  'Company Name',
  'Role',
  'Tel (1)',
  'Email',
] as const;

// Headers for Contact Logs Sheet
export const CONTACT_LOG_HEADERS = [
  'Log ID',
  'Type',
  'Company Name',
  'Contact Name',
  'Position',
  'Phone Number',
  'Email',
  'Responsible By',
  'Contact Date',
  'Counter',
  'Remarks'
] as const;

export const COMPACT_CONTACT_LOG_HEADERS = [
  'Contact Date',
  'Company Name',
  'Contact Name',
  'Position',
  'Phone Number',
  'Type',
  'Responsible By',
  'Remarks'
] as const;

// Headers for Site Survey Logs Sheet
export const SITE_SURVEY_LOG_HEADERS = [
  'Site ID',
  'Location',
  'Responsible By',
  'Date',
  'Start Time',
  'End Time',
  'Remark',
  'Next Action (If Any)',
] as const;

// Headers for Meetings Sheet
export const MEETING_HEADERS = [
  'Meeting ID',
  'Type',
  'Pipeline_ID',
  'Company Name',
  'Participants',
  'Responsible By',
  'Meeting Date',
  'Start Time',
  'End Time',
  'Status',
  'Remarks'
] as const;

export const COMPACT_MEETING_HEADERS = [
  'Meeting Date',
  'Company Name',
  'Participants',
  'Type',
  'Responsible By',
  'Status'
] as const;

// Headers for Users Sheet
export const USER_HEADERS = [
  'UserID',
  'Name',
  'Role',
  'Picture',
  'Password',
  'Email',
  'Status',
  'Phone 1',
  'Phone 2'
] as const;

// Headers for Quotations Sheet
export const QUOTATION_HEADERS = [
  'Quote No.',
  'File',
  'Quote Date',
  'Validity Date',
  'Company Name',
  'Company Address',
  'Contact Name',
  'Contact Number',
  'Contact Email',
  'Amount',
  'Tax Type',
  'CM',
  'Status',
  'Reason',
  'Payment Term',
  'Stock Status',
  'Created By',
  'Currency',
  'Prepared By',
  'Approved By',
  'Remark',
  'Terms and Conditions',
  'Prepared By Position',
  'Approved By Position',
  'ItemsJSON'
] as const;

// Headers for Sale Orders Sheet
export const SALE_ORDER_HEADERS = [
  'SO No.',
  'SO Date',
  'File',
  'Quote No.',
  'Company Name',
  'Contact Name',
  'Phone Number',
  'Email',
  'Tax',
  'Total Amount',
  'Commission',
  'Status',
  'Delivery Date',
  'Payment Term',
  'Bill Invoice',
  'Install Software',
  'Created By',
  'Currency',
  'Attachment',
  'ItemsJSON'
] as const;

// Headers for Pricelist Sheet
export const PRICELIST_HEADERS = [
  'Sheet Name',
  'Brand',
  'Category',
  'Code',
  'Model',
  'Description',
  'Dealer Price',
  'End User Price',
  'Promotion',
  'Status',
  'Currency'
] as const;

export const INVOICE_HEADERS = [
  'Inv No.',
  'Inv Date',
  'File',
  'SO No.',
  'Company Name',
  'Contact Name',
  'Phone Number',
  'Email',
  'Amount',
  'Taxable',
  'Status',
  'Created By',
  'Currency',
  'Attachment',
  'Company Address',
  'Payment Term',
  'Tin No.',
  'ItemsJSON'
] as const;

export const VENDOR_HEADERS = [
  'id',
  'vendor_name',
  'category',
  'contact_person',
  'phone',
  'email',
  'address',
  'website',
  'payment_terms',
  'tax_id',
  'status',
  'remarks',
  'created_at',
  'updated_at',
  'created_by'
] as const;

export const VENDOR_PRICELIST_HEADERS = [
  'id',
  'vendor_id',
  'brand',
  'model_name',
  'specification',
  'dealer_price',
  'user_price',
  'promotion',
  'currency',
  'status',
  'remarks',
  'created_at',
  'updated_at',
  'created_by'
] as const;