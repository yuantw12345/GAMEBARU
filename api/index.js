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

    if (action === 'cek_bot') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Sheet1!A:E',
      });
      const data = response.data.values || [];
      const antrean = [];

      for (let i = 1; i < data.length; i++) {
        const status = data[i][4] ? String(data[i][4]).trim().toUpperCase() : '';
        if (status === 'BOT') {
          antrean.push({
            row: i + 1,
            bank: data[i][0] || '',
            nominal: data[i][1] || '',
            no_rek: data[i][3] || ''
          });
        }
      }
      return res.json(antrean);
    } 

    else if (action === 'update_status') {
      const row = body.row;
      const status = body.status;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Sheet1!E${row}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[status]] }
      });
      return res.send('OK');
    }

    else if (action === 'appendSheet') {
      const text = body.text || '';
      const sheetName = body.sheetName || 'GRUPING 1';

      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!S1:Z200`,
      });

      const rowsData = text.split('\n').map(line => line.split('\t'));

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!S1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: rowsData
        }
      });
      return res.json({ success: true });
    }

    else if (action === 'clearSheet') {
      const sheetName = body.sheetName || 'GRUPING 1';

      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!S1:Z200`,
      });
      return res.json({ success: true });
    }

    // LOGIKA GETFORMAT DENGAN PENCARIAN PRESISI "NOMINAL WD"
    else if (action === 'getFormat') {
      const sheetName = body.sheetName || 'GRUPING 1';
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z50`,
      });
      const rows = response.data.values || [];

      const isiA1 = rows[0] && rows[0][0] ? rows[0][0] : '-';
      const isiA2 = (rows[1] && rows[1][0]) ? rows[1][0] : 'FORMAT WD DI ATAS 100JT';
      const isiA3 = (rows[2] && rows[2][0]) ? rows[2][0] : 'FORMAT WD DI ATAS 50JT';

      let nominalWD = 0;

      // Cari baris yang mengandung "nominal wd" secara spesifik
      for (let i = 0; i < rows.length; i++) {
        const barisTeks = rows[i].join(' ').toLowerCase();

        if (barisTeks.includes("nominal wd")) {
          const parts = barisTeks.split("nominal wd");
          if (parts.length > 1) {
            const setelahWd = parts[1];
            const matchAngka = setelahWd.match(/\d[\d,\.]*/g);
            if (matchAngka && matchAngka.length > 0) {
              const bersih = parseFloat(matchAngka[0].replace(/,|\./g, ''));
              if (!isNaN(bersih)) {
                nominalWD = bersih;
                break;
              }
            }
          }
        }
      }

      let adaWithdrawDiatas100Jt = false;
      let adaWithdrawDiatas50Jt = false;

      // Pengondisian rentang nominal WD
      if (nominalWD >= 100000000) {
        adaWithdrawDiatas100Jt = true;
        adaWithdrawDiatas50Jt = false;
      } else if (nominalWD >= 50000001 && nominalWD <= 99999999) {
        adaWithdrawDiatas100Jt = false;
        adaWithdrawDiatas50Jt = true;
      }

      return res.json({
        isiA1: isiA1,
        adaWithdrawDiatas100Jt: adaWithdrawDiatas100Jt,
        isiA2: isiA2,
        adaWithdrawDiatas50Jt: adaWithdrawDiatas50Jt,
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
