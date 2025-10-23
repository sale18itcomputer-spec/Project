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


// --- HELPER FUNCTION ---
function sheetDataToJSON(values, formulas) {
  if (values.length < 2) return []; 
  const headers = values[0].map(function(h) { return String(h).trim(); });
  const jsonData = [];

  for (let i = 1; i < values.length; i++) {
    const valueRow = values[i];
    const formulaRow = formulas[i];
    if (valueRow.every(function(cell) { return cell === ""})) continue;

    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]; 
      if (header.toLowerCase() === 'file') {
        if (formulaRow[j]) {
          obj[header] = formulaRow[j];
        } else {
          obj[header] = valueRow[j];
        }
      } else {
        obj[header] = valueRow[j];
      }
    }
    jsonData.push(obj);
  }
  return jsonData;
}


// --- CRUD IMPLEMENTATIONS ---
function createRecord(sheet, payload) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const trimmedHeaders = headers.map(function(h) { return String(h).trim(); });
  
  const newRow = trimmedHeaders.map(function(header) { 
    return payload[header] !== undefined ? payload[header] : ''; 
  });

  sheet.appendRow(newRow);
  return { message: 'Record created successfully.' };
}

function readRecords(sheet) {
  const dataRange = sheet.getDataRange();
  const values = dataRange.getDisplayValues(); 
  const formulas = dataRange.getFormulas();
  return sheetDataToJSON(values, formulas);
}

function updateRecord(sheet, primaryKey, primaryKeyValue, payload) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).trim(); });
  const primaryKeyIndex = headers.indexOf(primaryKey.trim());

  if (primaryKeyIndex === -1) {
    throw new Error(`Primary key '${primaryKey}' not found in sheet '${sheet.getName()}'.`);
  }

  const primaryKeyColumnValues = sheet.getRange(1, primaryKeyIndex + 1, sheet.getLastRow(), 1).getValues();
  
  for (let i = 1; i < primaryKeyColumnValues.length; i++) {
    if (String(primaryKeyColumnValues[i][0]).trim() == String(primaryKeyValue).trim()) {
      
      const rowIndexInSheet = i + 1; 
      const rowRange = sheet.getRange(rowIndexInSheet, 1, 1, sheet.getLastColumn());
      
      const rowValues = rowRange.getValues()[0];
      const rowFormulas = rowRange.getFormulas()[0];
      
      const newRow = rowFormulas.map(function(formula, colIndex) {
        return formula || rowValues[colIndex];
      });

      Object.keys(payload).forEach(function(key) {
        const columnIndex = headers.indexOf(key.trim());
        if (columnIndex !== -1) {
          newRow[columnIndex] = payload[key];
        }
      });
      
      rowRange.setValues([newRow]);
      
      return { message: `Record '${primaryKeyValue}' updated.` };
    }
  }

  throw new Error(`Record with ${primaryKey} = '${primaryKeyValue}' not found for update.`);
}

function deleteRecord(sheet, primaryKey, primaryKeyValue) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(function(h) { return String(h).trim(); });
  const primaryKeyIndex = headers.indexOf(primaryKey.trim());

  if (primaryKeyIndex === -1) {
    throw new Error(`Primary key '${primaryKey}' not found in sheet '${sheet.getName()}'.`);
  }

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][primaryKeyIndex]).trim() == String(primaryKeyValue).trim()) {
      sheet.deleteRow(i + 1);
      return { message: `Record '${primaryKeyValue}' deleted.` };
    }
  }

  throw new Error(`Record with ${primaryKey} = '${primaryKeyValue}' not found for deletion.`);
}

function createSheetFromTemplate(spreadsheet, templateSheetName, newSheetName, data) {
  const templateSheet = spreadsheet.getSheetByName(templateSheetName);
  if (!templateSheet) {
    throw new Error("Action failed: A sheet named '" + templateSheetName + "' must exist in your spreadsheet to be used as a template.");
  }
  
  let sheet = spreadsheet.getSheetByName(newSheetName);
  if (sheet) {
    sheet.clear();
    const templateRange = templateSheet.getDataRange();
    templateRange.copyTo(sheet.getRange(1, 1));
  } else {
    sheet = templateSheet.copyTo(spreadsheet).setName(newSheetName);
  }
  
  sheet.activate();
  
  if (templateSheetName === 'Quotation Template') {
    sheet.getRange('C7').setValue(data['Company Name'] || '');
    try { sheet.getRange('C8:C10').breakApart(); } catch(e) { /* ignore if not merged */ }
    sheet.getRange('C8:C9').merge().setValue(data['Company Address'] || '').setVerticalAlignment('top');
    sheet.getRange('C10').setValue(data['Contact Person'] || data['Contact Name'] || '');
    sheet.getRange('C11').setValue(data['Contact Tel'] || data['Contact Number'] || '');
    sheet.getRange('C12').setValue(data['Contact Email'] || '');

    sheet.getRange('F7').setValue(data['Quotation ID'] || '');
    try {
      var quoteDate = new Date(data['Quote Date']);
      sheet.getRange('F8').setValue(quoteDate).setNumberFormat("mmmm dd, yyyy");
    } catch(e) { sheet.getRange('F8').setValue(data['Quote Date'] || ''); }
    try {
      var validityDate = new Date(data['Validity Date']);
      sheet.getRange('F10').setValue(validityDate).setNumberFormat("mmmm dd, yyyy");
    } catch(e) { sheet.getRange('F10').setValue(data['Validity Date'] || ''); }
    sheet.getRange('F11').setValue(data['Stock Status'] || '');
    sheet.getRange('F12').setValue(data['Payment Term'] || '');
    
    // --- NEW ITEM HANDLING LOGIC ---
    const itemsFromJSON = JSON.parse(data.ItemsJSON || '[]');
    const sheetItems = [];
    var currentItemNumber = 1;

    itemsFromJSON.forEach(function(item) {
      // Only process items that have some identifying information.
      if ((item.modelName && item.modelName.trim() !== '') || (item.itemCode && item.itemCode.trim() !== '')) {
        
        let modelName = (item.modelName || '').trim();
        let fullDescription = modelName;
        
        // Check for additional specs and format them.
        if (item.description && item.description.trim() !== '') {
          var descriptionLines = item.description.split('\n');
          var formattedSpecs = descriptionLines
            .filter(function(line) { return line.trim() !== ''; })
            .map(function(line) { return "  - " + line.trim(); }) // Indent specs
            .join('\n');
          
          if (formattedSpecs) {
            fullDescription += '\n' + formattedSpecs;
          }
        }

        sheetItems.push({
          no: currentItemNumber++,
          itemCode: item.itemCode || '',
          description: fullDescription,
          modelName: modelName, // Keep original model name for styling length
          qty: item.qty,
          unitPrice: item.unitPrice,
        });
      }
    });

    const itemStartRow = 14;
    const templateItemRowCount = 10; // Number of item rows in the template
    const requiredRows = sheetItems.length;

    // Clear existing template item rows
    if (templateItemRowCount > 0) {
      sheet.getRange(itemStartRow, 1, templateItemRowCount, sheet.getLastColumn()).clearContent();
    }
    
    // Add more rows if needed
    if (requiredRows > templateItemRowCount) {
      sheet.insertRowsAfter(itemStartRow + templateItemRowCount - 1, requiredRows - templateItemRowCount);
    }
    
    if (requiredRows > 0) {
      // Copy formatting from the template's first item row to all new rows
      const formatSourceRange = templateSheet.getRange(itemStartRow, 1, 1, sheet.getLastColumn());
      const formatTargetRange = sheet.getRange(itemStartRow, 1, requiredRows, sheet.getLastColumn());
      formatSourceRange.copyTo(formatTargetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      
      // Loop through each item to set values and apply rich text formatting
      for (var i = 0; i < requiredRows; i++) {
        var item = sheetItems[i];
        var currentRow = itemStartRow + i;
        
        // Set values for standard cells
        sheet.getRange(currentRow, 1).setValue(item.no);
        sheet.getRange(currentRow, 2).setValue(item.itemCode);
        sheet.getRange(currentRow, 5).setValue(item.qty).setNumberFormat('#,##0');
        sheet.getRange(currentRow, 6).setValue(item.unitPrice).setNumberFormat('$#,##0.00');
        sheet.getRange(currentRow, 7).setFormula("=E" + currentRow + "*F" + currentRow).setNumberFormat('$#,##0.00');
        
        // Merge description cell
        const descriptionCell = sheet.getRange(currentRow, 3);
        sheet.getRange(currentRow, 3, 1, 2).merge();

        // Create and apply Rich Text for the description
        const modelNameLength = (item.modelName || '').length;
        const fullDescriptionText = item.description;

        const boldStyle = SpreadsheetApp.newTextStyle().setBold(true).build();
        const normalStyle = SpreadsheetApp.newTextStyle().setBold(false).setFontSize(10).build();

        let richTextBuilder = SpreadsheetApp.newRichTextValue()
          .setText(fullDescriptionText)
          .setTextStyle(0, modelNameLength, boldStyle);

        if (modelNameLength < fullDescriptionText.length) {
          richTextBuilder.setTextStyle(modelNameLength, fullDescriptionText.length, normalStyle);
        }
        
        const richText = richTextBuilder.build();
        descriptionCell.setRichTextValue(richText).setWrap(true).setVerticalAlignment('top');
      }
    }
    // --- END NEW ITEM HANDLING LOGIC ---
    
    try {
      const amountColumn = 'G';
      const itemRangeFormula = requiredRows > 0 ? "=SUM(" + amountColumn + itemStartRow + ":" + amountColumn + (itemStartRow + requiredRows - 1) + ")" : "0";
      
      const findSubTotal = sheet.createTextFinder("Grand Total (USD)").findNext();
      const findVat = sheet.createTextFinder("VAT 10% (USD)").findNext();
      const findGrandTotal = sheet.createTextFinder("Sub Total (USD)").findNext();

      if (findSubTotal && findVat && findGrandTotal) {
        findSubTotal.setValue("Sub Total (USD)");
        findGrandTotal.setValue("Grand Total (USD)");
        
        const subTotalValueCell = sheet.getRange(findSubTotal.getRow(), 7);
        const vatValueCell = sheet.getRange(findVat.getRow(), 7);
        const grandTotalValueCell = sheet.getRange(findGrandTotal.getRow(), 7);

        subTotalValueCell.setFormula(itemRangeFormula).setNumberFormat('$#,##0.00');
        vatValueCell.setFormula("=" + subTotalValueCell.getA1Notation() + "*0.1").setNumberFormat('$#,##0.00');
        grandTotalValueCell.setFormula("=" + subTotalValueCell.getA1Notation() + "+" + vatValueCell.getA1Notation()).setNumberFormat('$#,##0.00');
      }
    } catch(e) {
      Logger.log("Could not find total labels to populate formulas. Error: " + e.message);
    }
  } else if (templateSheetName === 'Sale Order Template') {
    sheet.getRange('C2').setValue(data['Company Name'] || '');
    sheet.getRange('C3').setValue(data['Company Address'] || '');
    sheet.getRange('C5').setValue(data['Contact Person'] || '');
    sheet.getRange('C6').setValue(data['Contact Tel'] || '');
    sheet.getRange('C7').setValue(data['Email'] || '');

    sheet.getRange('H3').setValue(data['SO NO.'] || '');
    try {
      var soDate = new Date(data['Order Date']);
      sheet.getRange('H4').setValue(soDate).setNumberFormat("m/d/yyyy");
    } catch(e) { sheet.getRange('H4').setValue(data['Order Date'] || ''); }
    try {
      var deliveryDate = new Date(data['Delivery Date']);
      sheet.getRange('H5').setValue(deliveryDate).setNumberFormat("m/d/yyyy");
    } catch(e) { sheet.getRange('H5').setValue(data['Delivery Date'] || ''); }
    sheet.getRange('H6').setValue(data['Payment Term'] || '');
    sheet.getRange('H7').setValue(data['Bill Invoice'] || '');

    sheet.getRange('C20').setValue(data['Install Software'] || '');
    
    const items = JSON.parse(data.ItemsJSON || '[]');
    const itemStartRow = 10;
    const templateItemRowCount = 10; 
    const requiredRows = items.length;
    
    if (templateItemRowCount > 0) {
      sheet.getRange(itemStartRow, 1, templateItemRowCount, 9).clearContent();
    }
    
    if (requiredRows > templateItemRowCount) {
      sheet.insertRowsAfter(itemStartRow + templateItemRowCount - 1, requiredRows - templateItemRowCount);
    }
    
    if (requiredRows > 0) {
      var itemData = items.map(function(item, index) {
        return [
          item.no,
          item.itemCode,
          item.description,
          '', 
          item.qty,
          item.unitPrice,
          item.commission,
          item.amount
        ];
      });
      
      var itemRange = sheet.getRange(itemStartRow, 1, requiredRows, 8);
      itemRange.setValues(itemData);
      
      for (var i = 0; i < requiredRows; i++) {
        var currentRow = itemStartRow + i;
        sheet.getRange(currentRow, 3, 1, 2).merge();
        sheet.getRange(currentRow, 6, 1, 3).setNumberFormat('$#,##0.00'); 
      }
    }
  }

  const sheetUrl = spreadsheet.getUrl() + '#gid=' + sheet.getSheetId();
  return { message: 'Sheet created and populated successfully.', url: sheetUrl };
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

  // If sheet is not found by name, and the name looks like a URL, try to find it by GID.
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

  const headerRanges = {
    'Company Name': 'C7',
    'Company Address': 'C8', 
    'Contact Name': 'C10',
    'Contact Number': 'C11',
    'Contact Email': 'C12',
    'Quote No.': 'F7',
    'Quote Date': 'F8',
    'Validity Date': 'F10',
    'Stock Status': 'F11',
    'Payment Term': 'F12'
  };

  const headerData = {};
  for (const key in headerRanges) {
    headerData[key] = sheet.getRange(headerRanges[key]).getDisplayValue();
  }
  
  const itemsStartRow = 14;
  const lastRow = sheet.getLastRow();
  const items = [];
  
  let endOfItemsRow = lastRow;
  try {
    // Find the cell with "Sub Total (USD)" to determine where the item list ends.
    const subTotalLabelCell = sheet.createTextFinder("Sub Total (USD)").findNext();
    if (subTotalLabelCell) {
        endOfItemsRow = subTotalLabelCell.getRow() - 1;
    }
  } catch(e) {
    Logger.log("Could not find 'Sub Total (USD)' label to determine end of items. Reading until last row. Error: " + e.message);
  }

  if (endOfItemsRow >= itemsStartRow) {
    const itemsRange = sheet.getRange(itemsStartRow, 1, endOfItemsRow - itemsStartRow + 1, 7);
    const itemDisplayValues = itemsRange.getDisplayValues();

    for (var i = 0; i < itemDisplayValues.length; i++) {
      var displayRow = itemDisplayValues[i];
      var noStr = String(displayRow[0]).trim();
      
      // Check if it's a main item row (the 'No.' column is a valid number)
      if (noStr !== '' && !isNaN(parseInt(noStr, 10))) {
        
        var fullDescriptionText = String(displayRow[2]);
        var descriptionLines = fullDescriptionText.split('\n');
        
        var modelName = descriptionLines[0] || '';
        var additionalSpecs = descriptionLines.slice(1).map(function(line) {
          // remove "  - " or "- " prefixes
          return line.trim().replace(/^\s*-\s*/, '');
        }).filter(Boolean).join('\n');

        items.push({
          no: parseInt(noStr, 10),
          itemCode: displayRow[1],
          modelName: modelName.trim(),
          description: additionalSpecs,
          qty: parseFloat(String(displayRow[4]).replace(/[^0-9.-]+/g,"")) || 0,
          unitPrice: parseFloat(String(displayRow[5]).replace(/[^0-9.-]+/g,"")) || 0,
          amount: parseFloat(String(displayRow[6]).replace(/[^0-9.-]+/g,"")) || 0,
        });
      }
    }
  }

  return {
      header: headerData,
      items: items
  };
}