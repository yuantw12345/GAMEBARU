const { google } = require('googleapis');
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

app.all('/api', async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const body = req.method === 'POST' ? req.body : req.query;
    const action = body.action;

    if (action === 'appendSheet') {
      const text = body.text;
      const sheetName = body.sheetName || 'GRUPING 1';
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[text]] }
      });
      return res.json({ success: true });
    }

    if (action === 'clearSheet') {
      const sheetName = body.sheetName || 'GRUPING 1';
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });
      return res.json({ success: true });
    }

    if (action === 'getFormat') {
      const sheetName = body.sheetName || 'GRUPING 1';
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:C10`,
      });
      const rows = response.data.values || [];
      const isiA1 = rows[0] && rows[0][0] ? rows[0][0] : '-';
      const isiA2 = rows[1] && rows[1][0] ? rows[1][0] : '';
      const isiA3 = rows[2] && rows[2][0] ? rows[2][0] : '';

      return res.json({
        isiA1: isiA1,
        adaWithdrawDiatas100Jt: Boolean(isiA2),
        isiA2: isiA2,
        adaWithdrawDiatas50Jt: Boolean(isiA3),
        isiA3: isiA3
      });
    }

    return res.status(400).json({ error: 'Action tidak dikenal' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = app;
