// services/excelService.js
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials', 'credentials.google.json');
const TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token_sheets.json');

export const HEADERS = [
  'ID', 'Phones', 'Submission Date', 'Business Name', 'Category', 'Country', 'Website', 'Target Market', 
  'Names', 'Emails', 'Occupations', 'Prefer Languages',
  'Brand', 'Other Brand', 'Key Contact Person', 'Comments', 'PDF'
];

function getAuthClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(token);
  return auth;
}

export async function getOrCreateSheet(fileName, folderId) {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  console.log(`[Sheets] Searching for file "${fileName}" in folder ${folderId}...`);
  const res = await drive.files.list({
    q: `name='${fileName}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id, name)'
  });

  if (res.data.files.length > 0) {
    console.log(`[Sheets] Found existing file: ${res.data.files[0].name} (${res.data.files[0].id})`);
    return res.data.files[0].id;
  }

  console.log(`[Sheets] Creating new file: "${fileName}"...`);
  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/vnd.google-apps.spreadsheet'
    },
    fields: 'id'
  });

  console.log(`[Sheets] New file created: ${fileName} (${file.data.id})`);
  return file.data.id;
}

async function getOrCreateSheetTab(sheets, spreadsheetId, sheetName) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const tabs = spreadsheet.data.sheets.map(s => s.properties.title);
  console.log(`[Sheets] Existing tabs: ${tabs.join(', ')}`);

  if (!sheetName) sheetName = "Other";

  // If tab already exists
  if (tabs.includes(sheetName)) {
    console.log(`[Sheets] Tab "${sheetName}" already exists`);
    return sheetName;
  }

  // If only "Sheet1" exists, rename it
  if (tabs.length === 1 && tabs[0] === "Sheet1") {
    console.log(`[Sheets] Renaming default tab "Sheet1" to "${sheetName}"`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateSheetProperties: {
            properties: { sheetId: spreadsheet.data.sheets[0].properties.sheetId, title: sheetName },
            fields: "title"
          }
        }]
      }
    });

    // Add headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      resource: { values: [HEADERS] }
    });

    return sheetName;
  }

  // Otherwise, create a new tab
  console.log(`[Sheets] Creating new tab: "${sheetName}"`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetName } } }]
    }
  });

  console.log(`[Sheets] Adding headers to tab "${sheetName}"`);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    resource: { values: [HEADERS] }
  });

  return sheetName;
}

export async function addRowToGoogleSheet(formData, sheetId, pdfId) {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const tabName = formData.businessInfo?.contactType || 'Other';
  console.log(`[Sheets] Adding row for contactType "${tabName}"`);

  const sheetName = await getOrCreateSheetTab(sheets, sheetId, tabName);

  // Get current rows to calculate next ID
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:A` // only first column (ID)
  });

  const currentRows = existing.data.values || [];
  let nextId = 1; // default if empty
  if (currentRows.length > 1) { // skip header
    const lastIdCell = currentRows[currentRows.length - 1][0]; 
    nextId = parseInt(lastIdCell) + 1;
  }

  // Build PDF link
  const pdfLink = pdfId ? `=HYPERLINK("https://drive.google.com/file/d/${pdfId}/view?usp=sharing";"Open PDF")` : '';
  const now = formatTimestamp();

  const values = [[
    nextId,
    formData.contacts.map(c => `${c.countryCode || ''}${c.phone || ''}`).join('; '), // Phones
    now, // Submission Date
    formData.businessName || formData.businessInfo?.businessName || '',
    formData.category || formData.businessInfo?.category || '',
    formData.country || formData.businessInfo?.country || '',
    formData.website || formData.businessInfo?.website || '',
    (formData.targetMarkets || formData.businessInfo?.targetMarkets || []).join?.(', ') || '',
    formData.contacts.map(c => c.name).join('; '),
    formData.contacts.map(c => c.email).join('; '),
    formData.contacts.map(c => c.occupation).join('; '),
    formData.contacts.map(c => c.language).join('; '),
    formData.brands?.join(', ') || '',
    formData.otherBrand || '',
    formData.keyContactPerson || '',
    formData.comments || '',
    pdfLink
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    resource: { values }
  });

  console.log(`[Sheets] Row added to tab "${sheetName}" with ID ${nextId} and PDF link`);
}

function formatTimestamp(date = new Date()) {
  const d = date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0'); // months 0-11
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
