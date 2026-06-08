// Headers for Pipelines Sheet
export const PIPELINE_HEADERS = [
  'Pipeline No',
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
  'Quote No',
  'Bid Value',
  'Invoice No',
  'SO No',
  'Remarks',
  'Conditional',
  'Currency'
] as const;

export const COMPACT_PIPELINE_HEADERS = [
  'Pipeline No',
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
  'Quote No',
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
  'ItemsJSON',
  'created_at',
  'updated_at',
] as const;

// Headers for Sale Orders Sheet
export const SALE_ORDER_HEADERS = [
  'SO No',
  'SO Date',
  'File',
  'Quote No',
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
  'Company Address',
  'Prepared By',
  'Approved By',
  'Prepared By Position',
  'Approved By Position',
  'Remark',
  'Terms and Conditions',
  'ItemsJSON'
] as const;

// Headers for Pricelist Sheet
export const PRICELIST_HEADERS = [
  'Code',
  'Brand',
  'Model',
  'Description',
  'End User Price',
  'Dealer Price',
  'Category',
  'Series',
  'Status',
  'Currency',
  'Promotion',
  'Qty',
  'image_url',
  'video_url',
  'extra_specs',
  'category_id',
  'subcategory_id',
  'updated_at',
] as const;

export const INVOICE_HEADERS = [
  'Inv No',
  'Inv Date',
  'File',
  'SO No',
  'Company Name',
  'Company Name (Khmer)',
  'Contact Name',
  'Phone Number',
  'Email',
  'Amount',
  'Taxable',
  'Tax Type',
  'Status',
  'Created By',
  'Currency',
  'Attachment',
  'Company Address',
  'Payment Term',
  'Tin No',
  'Deposit',
  'Exchange Rate',
  'Prepared By',
  'Approved By',
  'Prepared By Position',
  'Approved By Position',
  'ItemsJSON',
  'created_at',
  'updated_at',
] as const;

export const DELIVERY_ORDER_HEADERS = [
  'DO No',
  'DO Date',
  'Inv No',
  'SO No',
  'Company Name',
  'Company Address',
  'Contact Name',
  'Phone Number',
  'Email',
  'Currency',
  'Status',
  'Payment Term',
  'Delivery Date',
  'Prepared By',
  'Approved By',
  'Prepared By Position',
  'Approved By Position',
  'Remark',
  'Terms and Conditions',
  'File',
  'Created By',
  'ItemsJSON',
  'created_at',
  'updated_at',
] as const;

export const RECEIPT_HEADERS = [
  'RV No',
  'RV Date',
  'Inv No',
  'SO No',
  'DO No',
  'Company Name',
  'Company Address',
  'Contact Name',
  'Phone Number',
  'Email',
  'Amount',
  'Currency',
  'Payment Method',
  'Tax Type',
  'Status',
  'Payment Term',
  'Tin No',
  'Prepared By',
  'Approved By',
  'Prepared By Position',
  'Approved By Position',
  'Remark',
  'Terms and Conditions',
  'File',
  'Created By',
  'ItemsJSON',
  'created_at',
  'updated_at',
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

export const PURCHASE_ORDER_HEADERS = [
  'id',
  'po_number',
  'order_date',
  'delivery_date',
  'payment_term',
  'vendor_id',
  'vendor_name',
  'vendor_address',
  'vendor_contact',
  'vendor_phone',
  'vendor_email',
  'ship_to_address',
  'ordered_by_name',
  'ordered_by_phone',
  'sub_total',
  'vat_amount',
  'grand_total',
  'currency',
  'tax_type',
  'status',
  'prepared_by',
  'approved_by',
  'prepared_by_position',
  'approved_by_position',
  'remarks',
  'created_by',
  'created_at',
  'updated_at'
] as const;

export const PURCHASE_ORDER_ITEM_HEADERS = [
  'id',
  'po_id',
  'line_number',
  'item_number',
  'description',
  'qty',
  'unit_price',
  'total',
  'brand',
  'category',
] as const;

export const INVENTORY_HEADERS = [
  'id',
  'po_id',
  'po_number',
  'vendor_id',
  'vendor_name',
  'category',
  'code',
  'brand',
  'model_name',
  'description',
  'qty',
  'unit_price',
  'currency',
  'status',
  'created_by',
  'created_at',
  'updated_at',
] as const;

export const PRODUCT_INQUIRY_HEADERS = [
  'id',
  'inquiry_no',
  'inquiry_date',
  'company_name',
  'contact_name',
  'responsible_by',
  'priority',
  'status',
  'remarks',
  'procurement_notes',
  'created_by',
  'created_at',
  'updated_at',
] as const;

export const INQUIRY_ITEM_HEADERS = [
  'id',
  'inquiry_id',
  'line_number',
  'brand',
  'model_name',
  'specification',
  'qty',
  'target_price',
  'currency',
  'stock_type',
  'item_status',
  'actual_price',
  'lead_time_days',
  'vendor_name',
  'item_notes',
  'created_at',
  'updated_at',
] as const;

export const SERIAL_NUMBER_HEADERS = [
  'id', 'serial_number', 'brand', 'model_name', 'description',
  'inventory_id', 'so_no', 'company_name', 'contact_name',
  'warranty_start_date', 'warranty_end_date', 'warranty_period_months',
  'status', 'notes', 'created_by', 'created_at', 'updated_at',
] as const;

export const SERVICE_TICKET_HEADERS = [
  'id', 'ticket_no', 'ticket_date', 'ticket_type', 'priority', 'status',
  'company_name', 'contact_name', 'contact_phone', 'serial_number',
  'brand', 'model_name', 'problem_description', 'assigned_engineer',
  'received_date', 'estimated_completion_date', 'actual_completion_date',
  'resolution_notes', 'internal_notes', 'warranty_status',
  'repair_cost', 'currency', 'created_by', 'created_at', 'updated_at',
] as const;

export const PDI_RECORD_HEADERS = [
  'id', 'pdi_no', 'pdi_date', 'status', 'so_no',
  'company_name', 'contact_name', 'assigned_engineer',
  'inspection_notes', 'software_installed',
  'warranty_seal_applied', 'warranty_seal_number', 'seal_photo_url',
  'overall_condition', 'created_by', 'created_at', 'updated_at',
] as const;

export const SPARE_PART_HEADERS = [
  'id', 'part_no', 'part_name', 'brand', 'model_name', 'category',
  'qty', 'unit', 'unit_cost', 'currency', 'supplier_name', 'location',
  'status', 'min_qty', 'remarks', 'created_by', 'created_at', 'updated_at',
] as const;
