import fs from 'fs';
import path from 'path';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
const CREDENTIALS_PATH = path.join(process.cwd(), 'client_secret_drive.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

async function authorize() {
  let auth;
  if (fs.existsSync(TOKEN_PATH)) {
    // Use existing token
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    auth = new google.auth.OAuth2();
    auth.setCredentials(token);
  } else {
    // First-time authentication
    auth = await authenticate({
      keyfilePath: CREDENTIALS_PATH,
      scopes: SCOPES,
    });

    // Save token
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(auth.credentials, null, 2));
    console.log('Token stored to', TOKEN_PATH);
  }

  return auth;
}

async function listFiles() {
  const auth = await authorize();
  const drive = google.drive({ version: 'v3', auth });

  try {
    const res = await drive.files.list({
      pageSize: 10,
      fields: 'files(id, name)',
    });

    const files = res.data.files;
    if (!files || files.length === 0) {
      console.log('No files found.');
      return;
    }

    console.log('Files:');
    files.forEach(f => console.log(`${f.name} (${f.id})`));
  } catch (err) {
    console.error('Error calling Drive API:', err);
  }
}

listFiles();
