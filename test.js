import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

// Load credentials
const CREDENTIALS_PATH = path.join('C:/Users/dell/Desktop/form/credentials', 'client_secret_gmail.json');
const TOKEN_PATH = path.join('C:/Users/dell/Desktop/form/credentials', 'token_gmail.json');

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
const token = JSON.parse(fs.readFileSync(TOKEN_PATH));

const { client_id, client_secret, redirect_uris } = credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

oAuth2Client.setCredentials(token);

const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

// Helper to create base64 email
function makeEmail({ to, subject, message }) {
  const str = [
    `To: ${to}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    message,
  ].join('\n');

  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendMail() {
  try {
    const raw = makeEmail({
      to: 'heithem.moualdi@univ-constantine2.dz',
      subject: 'Test Email via Gmail API',
      message: 'Hello! This is a test email sent using Gmail API.',
    });

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    console.log('Email sent successfully!', res.data);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

sendMail();
