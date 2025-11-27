// services/excelService.js
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials', 'client_secret_sheets.json');
const TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token_sheets.json');

const HEADERS = [
  'Business Name', 'Category', 'Country', 'Website', 'Target Market',
  'Names', 'Phones', 'Emails', 'Occupations', 'Prefer Languages',
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

  // If only "Feuille 1" exists, rename it
  if (tabs.length === 1 && tabs[0] === "Feuille 1") {
    console.log(`[Sheets] Renaming default tab "Feuille 1" to "${sheetName}"`);
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

  // Use semicolon in HYPERLINK for locales like FR (safe: prefer semicolon)
  const pdfLink = pdfId ? `=HYPERLINK("https://drive.google.com/file/d/${pdfId}/view?usp=sharing";"Open PDF")` : '';

  const values = [[
    formData.businessName || formData.businessInfo?.businessName || '',
    formData.category || formData.businessInfo?.category || '',
    formData.country || formData.businessInfo?.country || '',
    formData.website || formData.businessInfo?.website || '',
    (formData.targetMarkets || formData.businessInfo?.targetMarkets || []).join?.(', ') || '',
    formData.contacts.map(c => c.name).join('; '),
    formData.contacts.map(c => `${c.countryCode || ''}${c.phone || ''}`).join('; '),
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

  console.log(`[Sheets] Row added to tab "${sheetName}" with PDF link`);
}
