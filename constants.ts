// Main Data Spreadsheet: Users
export const MAIN_DATA_SHEET_ID = '1qqWZ4bHE9ScYjj-LodWIRN1H2AQUlNB3CqZl-oMYus4';

// Company Data Spreadsheet: Company List, Contact List
export const COMPANY_SHEET_ID = '1lCMC7pSiYzB2orFMJTL9MznYeNXFEmsP5bK9HR1D4Ts';

// Log Data Spreadsheet: Pipelines, Contact Logs, Meeting Logs, Site Survey Logs
export const LOG_DATA_SHEET_ID = '17I4d9dsM5u2xMAIcjlQDZD2F5jVw_WN8vPeC3aLGuIE';

// Quotation Data Spreadsheet: Quotations
// IMPORTANT: Replace this with the actual Google Sheet ID for your quotations.
export const QUOTATION_DATA_SHEET_ID = '1zogMOf4x5vtqlBVtLwFCR6-bcbICoSLA3KGtckk-vyU';

// Sale Order Data Spreadsheet: Sale Orders
// IMPORTANT: Replace this with the actual Google Sheet ID for your sale orders.
export const SALE_ORDER_DATA_SHEET_ID = '1Teok1eSWrgbOrJa1y_gGLO3XiOKyt5CqjpaUq9C19jE';


// The following exports are maintained for potential legacy use, but it's recommended
// to use the more descriptive constants above. They now point to the correct file IDs.
export const Project__SHEET_ID = LOG_DATA_SHEET_ID; // Pipelines are in LOG_DATA
export const USER_SHEET_ID = MAIN_DATA_SHEET_ID;
export const QUOTATION_SHEET_ID = QUOTATION_DATA_SHEET_ID;
export const SALE_ORDER_SHEET_ID = SALE_ORDER_DATA_SHEET_ID;


// --- GIDs for Project Data Sheets ---
// IMPORTANT: Replace these placeholder GIDs with the actual GIDs from your Google Sheet.
// You can find the GID in the URL of your sheet (e.g., .../edit#gid=123456789).
export const Pipelines_SHEET_GID = '1469489261'; // Updated for testing
export const Contact_Logs_SHEET_GID = '1493144423';
export const Site_Survey_Logs_SHEET_GID = '1159470856';
export const Meetings_SHEET_GID = '880661605';
export const QUOTATIONS_SHEET_GID = '1273308814'; // Updated for testing
export const SALE_ORDERS_SHEET_GID = '1001071894'; // Updated for testing
export const COMPANY_SHEET_GID = '69906124'; // GID for the company sheet
export const CONTACT_LIST_SHEET_GID = '615486413';
export const USERS_SHEET_GID = '0'; // GID for the Users sheet

// --- Google Drive Folder ID ---
// IMPORTANT: Create a folder in your Google Drive for patent files.
// Right-click the folder > "Share" > "Share". Under "General access",
// change from "Restricted" to "Anyone with the link".
// Then, copy the folder ID from the URL (the part after 'folders/')
// and paste it here.
export const PATENT_FILES_FOLDER_ID = 'YOUR_PATENT_FILES_FOLDER_ID_HERE';