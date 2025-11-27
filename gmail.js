import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials', 'client_secret_gmail.json');
const TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token_gmail.json');

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
const { client_id, client_secret, redirect_uris } = credentials.web;

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

// Generate auth URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline', // important to get refresh_token
  scope: SCOPES,
});

console.log('Authorize this app by visiting this URL:', authUrl);

const rl = readline.createInterface({ input, output });

const code = await rl.question('Enter the code from that page here: ');
rl.close();

try {
  const { tokens } = await oAuth2Client.getToken(code.trim());
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('Token stored to', TOKEN_PATH);
} catch (err) {
  console.error('Error retrieving access token', err);
}
