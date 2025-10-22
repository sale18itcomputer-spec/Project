const API_URL = 'https://script.google.com/macros/s/AKfycbyFUU9tQT3VlQY-Pe_a2fVpHVKB77PtlMJ4U3PXtQiwl4h95odUpHbqMxqHKp7CleGxnA/exec';

// Central configuration for sheets
const SHEET_CONFIG: { [key: string]: { primaryKey: string } } = {
  'Pipelines': { primaryKey: 'Pipeline No.' },
  'Company List': { primaryKey: 'Company ID' },
  'Contact_List': { primaryKey: 'Customer ID' },
  'Users': { primaryKey: 'UserID' },
  'Meeting_Logs': { primaryKey: 'Meeting ID' },
  'Contact_Logs': { primaryKey: 'Log ID' }, 
  'Site_Survey_Logs': { primaryKey: 'Site ID' },
  'Quotations': { primaryKey: 'Quote No.' },
  'Sale Orders': { primaryKey: 'SO No.' },
};

// Helper function to handle API requests and errors
const apiRequest = async (body: object) => {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify(body),
            redirect: 'follow',
            mode: 'cors',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`Request failed: Server responded with an error (Status: ${response.status}).`);
        }
        
        const responseText = await response.text();
        if (!responseText) {
            throw new Error("Received an empty response from the server. This can happen during a script error.");
        }

        const result = JSON.parse(responseText);

        if (result.status === 'error') {
            throw new Error(result.message || 'An unknown error occurred in the backend script.');
        }

        if (result.status === 'success') {
            return result.data;
        }

        // Fallback for old response format, can be removed later
        return result;

    } catch (error) {
        console.error('Network or API call error:', error);
        if (error instanceof Error) {
            // Provide a more helpful error message for the most common failure case.
            if (error.message.includes('Failed to fetch')) {
                throw new Error(
                    'A network error occurred. This is often due to an incorrect Google Apps Script deployment. ' +
                    'Please ensure the script is deployed as a "Web app" with "Execute as: Me" and "Who has access: Anyone". ' +
                    'Also, verify the API_URL in the code matches your current deployment URL.'
                );
            }
            // Re-throw other specific error messages
            throw new Error(error.message);
        }
        // Fallback for non-Error exceptions
        throw new Error('An unknown network error occurred. Please check your connection.');
    }
};

/**
 * Creates a new record in a specified Google Sheet.
 * @param sheetName The name of the sheet to add the record to (e.g., "Pipelines").
 * @param payload An object where keys are column headers and values are the cell contents.
 */
export const createRecord = (sheetName: string, payload: object) => {
    return apiRequest({
        action: 'create',
        sheetName,
        payload
    });
};

/**
 * Reads all records from a specified Google Sheet.
 * @param sheetName The name of the sheet to read from.
 * @returns A promise that resolves with an array of records.
 */
export const readRecords = <T extends {}>(sheetName: string): Promise<T[]> => {
    return apiRequest({
        action: 'read',
        sheetName
    }) as Promise<T[]>;
};

/**
 * Updates an existing record in a specified Google Sheet.
 * @param sheetName The name of the sheet.
 * @param primaryKeyValue The value of the primary key for the row to update.
 * @param payload An object containing the key-value pairs to update.
 */
export const updateRecord = (sheetName: string, primaryKeyValue: string, payload: object) => {
    const primaryKey = SHEET_CONFIG[sheetName]?.primaryKey;
    if (!primaryKey) {
        return Promise.reject(new Error(`No primary key configured for sheet: ${sheetName}`));
    }
    return apiRequest({
        action: 'update',
        sheetName,
        primaryKey,
        primaryKeyValue,
        payload
    });
};

/**
 * Deletes a record from a specified Google Sheet.
 * @param sheetName The name of the sheet.
 * @param primaryKeyValue The value of the primary key for the row to delete.
 */
export const deleteRecord = (sheetName: string, primaryKeyValue: string) => {
    const primaryKey = SHEET_CONFIG[sheetName]?.primaryKey;
    if (!primaryKey) {
        return Promise.reject(new Error(`No primary key configured for sheet: ${sheetName}`));
    }
    return apiRequest({
        action: 'delete',
        sheetName,
        primaryKey,
        primaryKeyValue
    });
};

/**
 * Converts a File object to a base64 encoded string.
 * @param file The file to convert.
 * @returns A promise that resolves with the base64 string (without the data URI prefix).
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64String = result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
};


/**
 * Uploads a file to Google Drive via the Apps Script backend.
 * @param file The file to upload.
 * @returns A promise that resolves with the URL of the uploaded file.
 */
export const uploadFile = async (file: File): Promise<{ url: string }> => {
  const fileData = await fileToBase64(file);
  const payload = {
    fileName: file.name,
    mimeType: file.type,
    data: fileData,
  };
  return apiRequest({
    action: 'uploadFile',
    sheetName: 'Company List', 
    payload,
  }) as Promise<{ url: string }>;
};


/**
 * Reads the detailed data (headers and line items) from a specific quotation sheet.
 * @param quoteId The ID of the quotation sheet to read (e.g., "Q-0000062").
 */
export const readQuotationSheetData = (quoteId: string): Promise<{
    header: { [key: string]: any };
    items: any[];
}> => {
  return apiRequest({
    action: 'readSheetData',
    sheetName: 'Quotations', // This determines which spreadsheet file to use
    quoteId: quoteId
  }) as Promise<{ header: { [key: string]: any }; items: any[] }>;
};

/**
 * Creates a new sheet from a template for a quotation.
 * @param newSheetName The name for the new sheet (e.g., the Quotation ID).
 * @param data The full quotation data object.
 */
export const createQuotationSheet = (newSheetName: string, data: object): Promise<{message: string, url?: string}> => {
    return apiRequest({
        action: 'createSheetFromTemplate',
        sheetName: 'Quotations', // This determines which spreadsheet file to use via SHEET_MAP
        templateSheetName: 'Quotation Template',
        newSheetName: newSheetName,
        data: data
    }) as Promise<{message: string, url?: string}>;
};

/**
 * Creates a new sheet from a template for a sale order.
 * @param newSheetName The name for the new sheet (e.g., the Sale Order ID).
 * @param data The full sale order data object.
 */
export const createSaleOrderSheet = (newSheetName: string, data: object): Promise<{message: string, url?: string}> => {
    return apiRequest({
        action: 'createSheetFromTemplate',
        sheetName: 'Sale Orders',
        templateSheetName: 'Sale Order Template',
        newSheetName: newSheetName,
        data: data
    }) as Promise<{message: string, url?: string}>;
};