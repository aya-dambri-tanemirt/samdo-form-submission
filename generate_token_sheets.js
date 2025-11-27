import fs from 'fs';
import readline from 'readline';
import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets'
];

const CREDENTIALS_PATH = 'credentials/client_secret_sheets.json';
const TOKEN_PATH = 'credentials/token_sheets.json';

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
const { client_id, client_secret, redirect_uris } = credentials.web;

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES
});

console.log('Authorize this app by visiting this URL:\n', authUrl);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter the code from that page here: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log('Token stored to', TOKEN_PATH);
  } catch (err) {
    console.error('Error retrieving access token', err);
  }
});
