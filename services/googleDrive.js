// services/googleDrive.js
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { Readable } from 'stream';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials', 'credentials.google.json');
const TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token_drive.json');

function getDriveClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));

  const { client_id, client_secret, redirect_uris } = credentials.web;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(token);

  return google.drive({ version: 'v3', auth });
}

/**
 * Create or fetch folder at root (no parent)
 */
export async function getOrCreateFolder(name) {
  const drive = getDriveClient();

  const res = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)'
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder'
    },
    fields: 'id'
  });

  return folder.data.id;
}

/**
 * Create or fetch folder inside a parent folder
 */
export async function getOrCreateFolderInParent(parentId, folderName) {
  const drive = getDriveClient();

  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)'
  });

  if (res.data.files.length > 0) return res.data.files[0].id;

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      parents: [parentId],
      mimeType: 'application/vnd.google-apps.folder'
    },
    fields: 'id'
  });

  return folder.data.id;
}

/**
 * Upload PDF to a folder
 */
export async function uploadPDFToDrive(bufferOrStream, fileName, folderId) {
  const drive = getDriveClient();

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

  return { id: res.data.id, webViewLink: res.data.webViewLink };
}
