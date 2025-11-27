import fs from 'fs';
import path from 'path';
import express from 'express';
import open from 'open';
import { google } from 'googleapis';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials', 'client_secret_gmail.json');
const TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token_gmail.json');
const PORT = 3001;

// Gmail scope
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

// Load credentials
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
const { client_id, client_secret, redirect_uris } = credentials.web;

// OAuth2 client
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

// Express server to handle OAuth callback
const app = express();

app.get('/oauth2callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) throw new Error('No code found in query');

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('✅ Token saved to', TOKEN_PATH);

    res.send('Authorization successful! You can close this tab.');
    process.exit(0); // stop server
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving token');
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Generate auth URL
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Opening browser for authorization...');
  await open(authUrl);
});
