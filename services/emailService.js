import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials', 'credentials.google.json');
const TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token_gmail.json');

function getAuthClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(token);

  auth.on('tokens', (tokens) => {
    console.log('[emailService] Tokens refreshed');
    if (tokens.refresh_token) token.refresh_token = tokens.refresh_token;
    token.access_token = tokens.access_token;
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
  });

  return auth;
}

export async function sendEmail({ to, subject, body, attachmentBuffer, attachmentName }) {
  try {
    console.log('[emailService] Preparing email for:', to);

    const gmail = google.gmail({ version: 'v1', auth: getAuthClient() });

    const messageParts = [
      `From: SAMDO Team <me>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="sepboundary"',
      '',
      '--sepboundary',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body,
      '',
      '--sepboundary',
      `Content-Type: application/pdf; name="${attachmentName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachmentName}"`,
      '',
      attachmentBuffer.toString('base64'),
      '--sepboundary--'
    ];

    const raw = Buffer.from(messageParts.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });

    console.log('[emailService] Email sent, id:', res.data.id);
    return true;

  } catch (err) {
    console.error('[emailService] Gmail send error:', err);
    return false;
  }
}
