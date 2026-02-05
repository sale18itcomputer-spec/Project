// --- IMPORTANT DEPLOYMENT INSTRUCTIONS ---
// To make this script work with your web app, you MUST deploy it correctly.
// "Failed to fetch" errors in the web app are almost always caused by incorrect deployment.
//
// 1. In the Apps Script Editor, click on "Deploy" > "New deployment".
// 2. For "Select type", choose "Web app".
// 3. Under "Configuration":
//    - Description: Give it a name, e.g., "Limperial Dashboard API v12".
//    - Execute as: Set this to "Me".
//    - Who has access: SET THIS TO "ANYONE". This is the most critical step.
// 4. Click "Deploy".
// 5. Google will give you a new "Web app URL". This is your API endpoint.
//    - COPY THIS URL and paste it as the `API_URL` in your frontend's `services/api.ts` file.
//
// **EVERY TIME YOU CHANGE THIS SCRIPT**, you must create a NEW deployment version.
// 1. Click "Deploy" > "Manage deployments".
// 2. Select your active deployment and click the pencil icon (Edit).
// 3. From the "Version" dropdown, select "New version".
// 4. Click "Deploy". You do not need to copy the URL again unless it's the first deployment.
//
// **SETUP FOR NEW FEATURES**
// - File Uploads:
//   1. Create a folder in Google Drive where you want to store uploaded files.
//   2. Right-click the folder > "Share" > "Share". Under "General access", change "Restricted" to "Anyone with the link".
//   3. Copy the folder ID from the URL in your browser's address bar. It's the long string of characters after `.../folders/`.
//   4. Paste this ID into the `PATENT_FILES_FOLDER_ID` constant below.

// --- CONFIGURATION ---

// FOLDER ID for storing uploaded patent files.
const PATENT_FILES_FOLDER_ID = '1vnbd4kPKJCokB4f7uXPvq0a0Rati3wbb';

// SPREADSHEET IDs
const SPREADSHEET_IDS_DEFAULT = {
  'MAIN_DATA': '1qqWZ4bHE9ScYjj-LodWIRN1H2AQUlNB3CqZl-oMYus4',
  'COMPANY_DATA': '1lCMC7pSiYzB2orFMJTL9MznYeNXFEmsP5bK9HR1D4Ts',
  'LOG_DATA': '17I4d9dsM5u2xMAIcjlQDZD2F5jVw_WN8vPeC3aLGuIE',
  'QUOTATION_DATA': '1zogMOf4x5vtqlBVtLwFCR6-bcbICoSLA3KGtckk-vyU',
  'SALE_ORDER_DATA': '1Teok1eSWrgbOrJa1y_gGLO3XiOKyt5CqjpaUq9C19jE',
  'PRICELIST_DATA': '1Z0xeN_yb9TtBdgyN6XDIbosBarnd9U7AD3eJdKVzMcI',
};


// --- MAIN HANDLER ---
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const requestData = JSON.parse(e.postData.contents);
    const { action, sheetName, quoteId } = requestData;

    const SPREADSHEET_IDS = SPREADSHEET_IDS_DEFAULT;

    const SHEET_MAP = {
      'Pipelines': SPREADSHEET_IDS.LOG_DATA,
      'Users': SPREADSHEET_IDS.MAIN_DATA,
      'Quotations': SPREADSHEET_IDS.QUOTATION_DATA,
      'Sale Orders': SPREADSHEET_IDS.SALE_ORDER_DATA,
      'Company List': SPREADSHEET_IDS.COMPANY_DATA,
      'Contact_List': SPREADSHEET_IDS.COMPANY_DATA,
      'Contact_Logs': SPREADSHEET_IDS.LOG_DATA,
      'Site_Survey_Logs': SPREADSHEET_IDS.LOG_DATA,
      'Meeting_Logs': SPREADSHEET_IDS.LOG_DATA,
      'Raw': SPREADSHEET_IDS.PRICELIST_DATA,
    };

    // The 'uploadFile' action doesn't operate on a sheet but still needs a valid spreadsheet ID
    // to pass the initial check. We handle it as a special case.
    if (action === 'uploadFile') {
      const result = uploadFileToDrive(requestData.payload);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'success', data: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // The 'batchRead' action operates on multiple sheets, so we handle it before the single-sheet check
    if (action === 'batchRead') {
      const result = batchReadRecords(requestData.sheets);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'success', data: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (!sheetName || !SHEET_MAP[sheetName]) {
      throw new Error("Invalid or missing 'sheetName'.");
    }

    const spreadsheet = SpreadsheetApp.openById(SHEET_MAP[sheetName]);

    let sheet;
    if (action !== 'createSheetFromTemplate' && action !== 'readSheetData') {
      sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        throw new Error(`Sheet with name '${sheetName}' not found in the specified spreadsheet file.`);
      }
    }


    let result;

    switch (action) {
      case 'create':
        result = createRecord(sheet, requestData.payload);
        break;
      case 'read':
        result = readRecords(sheet);
        break;
      case 'update':
        result = updateRecord(sheet, requestData.primaryKey, requestData.primaryKeyValue, requestData.payload);
        break;
      case 'delete':
        result = deleteRecord(sheet, requestData.primaryKey, requestData.primaryKeyValue);
        break;
      case 'createSheetFromTemplate':
        result = createSheetFromTemplate(spreadsheet, requestData.templateSheetName, requestData.newSheetName, requestData.data);
        break;
      case 'readSheetData':
        result = readDetailedSheetData(spreadsheet, quoteId);
        break;
      default:
        throw new Error(`Invalid action: '${action}'.`);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log(error);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- NEW FILE UPLOAD FUNCTION ---

/**
 * Uploads a file (sent as base64) to a specific Google Drive folder.
 * @param {Object} payload - The data containing file details.
 * @param {string} payload.fileName - The name of the file.
 * @param {string} payload.mimeType - The MIME type of the file.
 * @param {string} payload.data - The base64 encoded file content.
 * @returns {Object} An object containing the URL of the uploaded file.
 */
function uploadFileToDrive(payload) {
  if (!PATENT_FILES_FOLDER_ID || PATENT_FILES_FOLDER_ID.includes('YOUR_PATENT_FILES_FOLDER_ID')) {
    throw new Error("Configuration Error: 'PATENT_FILES_FOLDER_ID' is not set in the Apps Script. Please provide a valid Google Drive Folder ID.");
  }

  const { fileName, mimeType, data } = payload;

  const decodedData = Utilities.base64Decode(data);
  const blob = Utilities.newBlob(decodedData, mimeType, fileName);

  const folder = DriveApp.getFolderById(PATENT_FILES_FOLDER_ID);

  const file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return { url: file.getUrl() };
}


// --- HELPER FUNCTIONS ---
function sheetDataToJSON(values, formulas) {
  if (values.length < 2) return [];
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const jsonData = [];

  for (let i = 1; i < values.length; i++) {
    const valueRow = values[i];
    const formulaRow = formulas ? formulas[i] : [];
    if (valueRow.every(function (cell) { return cell === "" })) continue;

    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) { // Ensure header is not empty
        const formula = formulaRow && formulaRow[j];
        // Only prioritize formula if it's a HYPERLINK, otherwise use the display value.
        if (formula && formula.toUpperCase().startsWith('=HYPERLINK(')) {
          obj[header] = formula;
        } else {
          obj[header] = valueRow[j];
        }
      }
    }
    jsonData.push(obj);
  }
  return jsonData;
}

function rowToJSON(headers, values, formulas) {
  const obj = {};
  headers.forEach(function (header, index) {
    if (header) { // Ensure header is not empty
      const formula = formulas && formulas[index];
      // Only prioritize formula if it's a HYPERLINK, otherwise use the display value.
      if (formula && formula.toUpperCase().startsWith('=HYPERLINK(')) {
        obj[header] = formula;
      } else if (values) {
        obj[header] = values[index];
      }
    }
  });
  return obj;
}


// --- CRUD IMPLEMENTATIONS ---
function createRecord(sheet, payload) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });

  const newRow = headers.map(function (header) {
    return payload[header] !== undefined ? payload[header] : '';
  });

  sheet.appendRow(newRow);

  const lastRowIndex = sheet.getLastRow();

  // Read the newly created row back and return it
  const newRowRange = sheet.getRange(lastRowIndex, 1, 1, sheet.getLastColumn());
  const newRowValues = newRowRange.getDisplayValues()[0];
  const newRowFormulas = newRowRange.getFormulas()[0];

  const newRecord = rowToJSON(headers, newRowValues, newRowFormulas);

  return newRecord; // Return the full record object
}

function readRecords(sheet) {
  const dataRange = sheet.getDataRange();
  const values = dataRange.getDisplayValues();
  const formulas = dataRange.getFormulas();
  return sheetDataToJSON(values, formulas);
}

function batchReadRecords(sheetNames) {
  if (!Array.isArray(sheetNames)) {
    throw new Error("Invalid 'sheets' payload: must be an array of sheet names.");
  }

  const SPREADSHEET_IDS = SPREADSHEET_IDS_DEFAULT;

  const SHEET_MAP = {
    'Pipelines': SPREADSHEET_IDS.LOG_DATA,
    'Users': SPREADSHEET_IDS.MAIN_DATA,
    'Quotations': SPREADSHEET_IDS.QUOTATION_DATA,
    'Sale Orders': SPREADSHEET_IDS.SALE_ORDER_DATA,
    'Company List': SPREADSHEET_IDS.COMPANY_DATA,
    'Contact_List': SPREADSHEET_IDS.COMPANY_DATA,
    'Contact_Logs': SPREADSHEET_IDS.LOG_DATA,
    'Site_Survey_Logs': SPREADSHEET_IDS.LOG_DATA,
    'Meeting_Logs': SPREADSHEET_IDS.LOG_DATA,
    'Raw': SPREADSHEET_IDS.PRICELIST_DATA,
  };

  const results = {};
  const openedSpreadsheets = {}; // Cache opened spreadsheets

  sheetNames.forEach(function (sheetName) {
    try {
      const spreadsheetId = SHEET_MAP[sheetName];
      if (!spreadsheetId) {
        return;
      }

      let spreadsheet;
      if (openedSpreadsheets[spreadsheetId]) {
        spreadsheet = openedSpreadsheets[spreadsheetId];
      } else {
        spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        openedSpreadsheets[spreadsheetId] = spreadsheet;
      }

      const sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet) {
        results[sheetName] = readRecords(sheet); // reuse existing readRecords logic
      } else {
        results[sheetName] = []; // Return empty array if sheet not found
      }
    } catch (e) {
      Logger.log("Error reading sheet: " + sheetName + ". " + e.toString());
      results[sheetName] = []; // Return empty array on error
    }
  });

  return results;
}

function updateRecord(sheet, primaryKey, primaryKeyValue, payload) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  const primaryKeyIndex = headers.indexOf(primaryKey.trim());

  if (primaryKeyIndex === -1) {
    throw new Error(`Primary key '${primaryKey}' not found in sheet '${sheet.getName()}'.`);
  }

  const primaryKeyColumnValues = sheet.getRange(1, primaryKeyIndex + 1, sheet.getLastRow(), 1).getValues();

  for (let i = 1; i < primaryKeyColumnValues.length; i++) {
    if (String(primaryKeyColumnValues[i][0]).trim() == String(primaryKeyValue).trim()) {

      const rowIndexInSheet = i + 1;
      const rowRange = sheet.getRange(rowIndexInSheet, 1, 1, sheet.getLastColumn());

      const oldRowValues = rowRange.getValues()[0];
      const oldRowFormulas = rowRange.getFormulas()[0];
      const oldRow = oldRowFormulas.map(function (formula, colIndex) {
        return formula || oldRowValues[colIndex];
      });

      const newRow = [...oldRow]; // Create a copy

      Object.keys(payload).forEach(function (key) {
        const columnIndex = headers.indexOf(key.trim());
        if (columnIndex !== -1) {
          newRow[columnIndex] = payload[key];
        }
      });

      rowRange.setValues([newRow]);

      // Read the updated row back
      const updatedValues = rowRange.getDisplayValues()[0];
      const updatedFormulas = rowRange.getFormulas()[0];
      const updatedRecord = rowToJSON(headers, updatedValues, updatedFormulas);

      return updatedRecord; // Return the full updated record
    }
  }

  throw new Error(`Record with ${primaryKey} = '${primaryKeyValue}' not found for update.`);
}

function deleteRecord(sheet, primaryKey, primaryKeyValue) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(function (h) { return String(h).trim(); });
  const primaryKeyIndex = headers.indexOf(primaryKey.trim());

  if (primaryKeyIndex === -1) {
    throw new Error(`Primary key '${primaryKey}' not found in sheet '${sheet.getName()}'.`);
  }

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][primaryKeyIndex]).trim() == String(primaryKeyValue).trim()) {
      sheet.deleteRow(i + 1);
      return { deletedId: primaryKeyValue };
    }
  }

  throw new Error(`Record with ${primaryKey} = '${primaryKeyValue}' not found for deletion.`);
}

/**
 * Creates a new sheet from scratch and populates it with headers (row 1) and data (row 2).
 * No template is needed - creates a fresh sheet every time.
 */
function createSheetFromTemplate(spreadsheet, templateSheetName, newSheetName, data) {
  // Check if sheet already exists
  let sheet = spreadsheet.getSheetByName(newSheetName);

  if (sheet) {
    // If sheet exists, clear all content
    sheet.clear();
  } else {
    // Create a completely new sheet (no template copying)
    sheet = spreadsheet.insertSheet(newSheetName);
  }

  // Activate the new sheet
  sheet.activate();

  // Handle different template types
  if (templateSheetName === 'Quotation Template') {
    // Define headers for quotation
    const headers = [
      'Quote No.',
      'Quote Date',
      'Validity Date',
      'Company Name',
      'Company Address',
      'Contact Name',
      'Contact Number',
      'Contact Email',
      'Stock Status',
      'Payment Term',
      'ItemsJSON',
      'Sub Total',
      'VAT',
      'Grand Total',
      'Currency',
      'Prepared By',
      'Approved By',
      'Remark',
      'Terms and Conditions',
      'Prepared By Position',
      'Approved By Position',
      'Tax Type'
    ];

    // Parse items to calculate totals
    const items = JSON.parse(data.ItemsJSON || '[]');
    let subTotal = 0;
    items.forEach(function (item) {
      if (item.no && typeof item.no === 'number') {
        subTotal += (item.qty || 0) * (item.unitPrice || 0);
      }
    });

    const taxType = data['Tax Type'] || 'VAT';
    const vat = taxType === 'NON-VAT' ? 0 : subTotal * 0.1;

    const grandTotal = subTotal + vat;
    const currency = data.Currency || 'USD';

    // Create data row matching headers
    const dataRow = [
      data['Quote No.'] || '',
      data['Quote Date'] || '',
      data['Validity Date'] || '',
      data['Company Name'] || '',
      data['Company Address'] || '',
      data['Contact Name'] || '',
      data['Contact Number'] || '',
      data['Contact Email'] || '',
      data['Stock Status'] || '',
      data['Payment Term'] || '',
      data.ItemsJSON || '[]',
      subTotal,
      vat,
      grandTotal,
      currency,
      data['Prepared By'] || '',
      data['Approved By'] || '',
      data.Remark || '',
      data['Terms and Conditions'] || '',
      data['Prepared By Position'] || '',
      data['Approved By Position'] || '',
      taxType
    ];

    // Set headers in row 1
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    // Set data in row 2
    sheet.getRange(2, 1, 1, dataRow.length).setValues([dataRow]);

    // Format headers (bold, background color)
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');

    // Format number columns
    const currencyFormat = currency === 'KHR' ? '៛#,##0.00' : '$#,##0.00';
    sheet.getRange(2, 12, 1, 3).setNumberFormat(currencyFormat); // Sub Total, VAT, Grand Total

    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);

  } else if (templateSheetName === 'Sale Order Template') {
    // Define headers for sale order
    const headers = [
      'SO NO.',
      'Order Date',
      'Delivery Date',
      'Company Name',
      'Company Address',
      'Contact Person',
      'Contact Tel',
      'Email',
      'Payment Term',
      'Bill Invoice',
      'Install Software',
      'ItemsJSON',
      'Sub Total',
      'VAT',
      'Grand Total',
      'Currency'
    ];

    // Parse items to calculate totals
    const items = JSON.parse(data.ItemsJSON || '[]');
    let subTotal = 0;
    items.forEach(function (item) {
      subTotal += parseFloat(item.amount || 0);
    });

    const billInvoice = data['Bill Invoice'] || 'VAT';
    const vat = billInvoice === 'NON-VAT' ? 0 : subTotal * 0.1;

    const grandTotal = subTotal + vat;
    const currency = data.Currency || 'USD';

    // Create data row matching headers
    const dataRow = [
      data['SO NO.'] || '',
      data['Order Date'] || '',
      data['Delivery Date'] || '',
      data['Company Name'] || '',
      data['Company Address'] || '',
      data['Contact Person'] || '',
      data['Contact Tel'] || '',
      data['Email'] || '',
      data['Payment Term'] || '',
      data['Bill Invoice'] || '',
      data['Install Software'] || '',
      data.ItemsJSON || '[]',
      subTotal,
      vat,
      grandTotal,
      currency
    ];

    // Set headers in row 1
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    // Set data in row 2
    sheet.getRange(2, 1, 1, dataRow.length).setValues([dataRow]);

    // Format headers
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#34a853')
      .setFontColor('#ffffff');

    // Format number columns
    const currencyFormat = currency === 'KHR' ? '៛#,##0.00' : '$#,##0.00';
    sheet.getRange(2, 13, 1, 3).setNumberFormat(currencyFormat); // Sub Total, VAT, Grand Total

    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);
  }

  // Freeze header row
  sheet.setFrozenRows(1);

  const sheetUrl = spreadsheet.getUrl() + '#gid=' + sheet.getSheetId();
  return { message: 'Sheet created with headers and data successfully.', url: sheetUrl };
}

function getSheetByGid(spreadsheet, gid) {
  const sheets = spreadsheet.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() == gid) {
      return sheets[i];
    }
  }
  return null;
}

function readDetailedSheetData(spreadsheet, sheetNameToRead) {
  let sheet = spreadsheet.getSheetByName(sheetNameToRead);

  if (!sheet && String(sheetNameToRead).includes('gid=')) {
    const gidMatch = String(sheetNameToRead).match(/gid=(\d+)/);
    if (gidMatch && gidMatch[1]) {
      const gid = gidMatch[1];
      sheet = getSheetByGid(spreadsheet, gid);
    }
  }

  if (!sheet) {
    throw new Error(`Sheet with name or GID matching '${sheetNameToRead}' not found.`);
  }

  // Check if this is the new data format (by checking if A1 is 'Quote No.')
  const firstHeader = sheet.getRange("A1").getDisplayValue();
  if (firstHeader !== 'Quote No.') {
    throw new Error("The sheet format is not the expected data format. It might be an old template-based sheet which is no longer supported for editing.");
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dataRow = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];

  const headerData = {};
  let items = [];

  headers.forEach(function (header, index) {
    const value = dataRow[index];
    if (header === 'ItemsJSON') {
      try {
        items = JSON.parse(value || '[]');
      } catch (e) {
        Logger.log("Error parsing ItemsJSON for sheet " + sheetNameToRead + ": " + e.message);
        items = [];
      }
    } else {
      headerData[header] = value;
    }
  });

  return {
    header: headerData,
    items: items
  };
}