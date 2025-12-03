import fs from 'fs';
import express from 'express';
import { google } from 'googleapis';

// ===== PATHS =====
const CREDENTIALS_PATH = 'credentials/credentials.google.json';
const TOKEN_PATHS = {
  drive: 'credentials/token_drive.json',
  sheets: 'credentials/token_sheets.json',
  gmail: 'credentials/token_gmail.json',
};

// ===== SERVICE SCOPES =====
const SCOPES = {
  drive: ['https://www.googleapis.com/auth/drive.file'],
  sheets: [  'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/spreadsheets'],
  gmail: ['https://www.googleapis.com/auth/gmail.send'],
};

// ===== LOAD CREDENTIALS =====
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
const { client_id, client_secret, redirect_uris } = credentials.web;

// ===== EXPRESS INIT =====
const app = express();
const port = 3001;

// ===== CREATE OAUTH CLIENT =====
function createOAuthClient() {
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

// ===== GENERATE AUTH ROUTES DYNAMICALLY =====
Object.keys(SCOPES).forEach((serviceName) => {
    app.get(`/${serviceName}`, (req, res) => {
      const oAuth2Client = createOAuthClient();
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES[serviceName],
        state: serviceName,   // <--- THIS IS THE FIX
      });
      res.redirect(authUrl);
    });
  });  

// ===== UNIVERSAL CALLBACK HANDLER =====
app.get('/google/callback', async (req, res) => {
    const serviceName = req.query.state || null;
    const code = req.query.code;
  
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }
  
    if (!serviceName || !TOKEN_PATHS[serviceName]) {
      return res.status(400).send('Unknown service request');
    }
  
    try {
      const oAuth2Client = createOAuthClient();
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
  
      fs.writeFileSync(TOKEN_PATHS[serviceName], JSON.stringify(tokens));
      console.log(`✔ Tokens saved for ${serviceName} at ${TOKEN_PATHS[serviceName]}`);
  
      res.send(`Authorization complete for <b>${serviceName}</b>!<br>Token saved in <b>${TOKEN_PATHS[serviceName]}</b>.<br>You can close this page.`);
    } catch (err) {
      console.error('❌ Error retrieving token', err);
      res.status(500).send('Error retrieving access token');
    }
  });

// ===== START SERVER =====
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`🔐 Visit /drive, /sheets, or /gmail to begin authentication.`);
});
