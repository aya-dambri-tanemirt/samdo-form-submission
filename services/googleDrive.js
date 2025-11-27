// services/googleDrive.js
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { Readable } from 'stream';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials', 'client_secret_drive.json');
const TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token_drive.json');

function getDriveClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));

  const { client_id, client_secret, redirect_uris } = credentials.web;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(token);

  return google.drive({ version: 'v3', auth });
}

export async function getOrCreateFolder(folderName) {
  const drive = getDriveClient();

  const res = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)'
  });

  if (res.data.files.length > 0) return res.data.files[0].id;

  const folder = await drive.files.create({
    requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id'
  });

  return folder.data.id;
}

/**
 * Upload PDF buffer to Drive (fast, non-resumable)
 * Returns { id, webViewLink }
 */
export async function uploadPDFToDrive(bufferOrStream, fileName, folderId) {
  const drive = getDriveClient();

  // If multer.memoryStorage, bufferOrStream is Buffer; support both Buffer and Readable
  const mediaBody = Buffer.isBuffer(bufferOrStream)
    ? Readable.from(bufferOrStream)
    : bufferOrStream;

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/pdf'
    },
    media: {
      mimeType: 'application/pdf',
      body: mediaBody
    },
    fields: 'id, webViewLink'
  });

  console.log(`[Drive] PDF uploaded ${fileName} (ID: ${res.data.id})`);
  return { id: res.data.id, webViewLink: res.data.webViewLink };
}

/**
 * Share file with an email silently (no notification)
 * Keep if you want to re-enable sharing later.
 */
export async function shareFileWithEmail(fileId, email) {
  const drive = getDriveClient();

  await drive.permissions.create({
    fileId,
    requestBody: {
      type: 'user',
      role: 'reader',
      emailAddress: email
    },
    sendNotificationEmail: false
  });

  console.log(`[Drive] File ${fileId} shared with ${email} (no notification)`);
}
