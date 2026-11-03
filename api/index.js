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

    // 1. LOGIKA: cek_bot
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

    // 2. LOGIKA: update_status
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

    // 3. LOGIKA: appendSheet (Menyebar dari Kolom S ke kanan)
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

    // 4. LOGIKA: clearSheet
    else if (action === 'clearSheet') {
      const sheetName = body.sheetName || 'GRUPING 1';

      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!S1:Z200`,
      });
      return res.json({ success: true });
    }

    // 5. LOGIKA: getFormat (FOKUS EKSTRAKSI NOMINAL WD)
    else if (action === 'getFormat') {
      const sheetName = body.sheetName || 'GRUPING 1';
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z50`,
      });
      const rows = response.data.values || [];

      const isiA1 = rows[0] && rows[0][0] ? rows[0][0] : '-';
      const isiA2 = rows[1] && rows[1][0] ? rows[1][0] : '';
      const isiA3 = rows[2] && rows[2][0] ? rows[2][0] : '';

      let adaWithdrawDiatas100Jt = false;
      let adaWithdrawDiatas50Jt = false;
      let nominalWD = 0;

      // Cari baris yang khusus berisi "Nominal WD" atau kata "Withdraw"
      for (let i = 0; i < rows.length; i++) {
        const barisTeks = rows[i].join(' ').toLowerCase();

        // Mengutamakan baris "nominal wd" / "wd"
        if (barisTeks.includes("nominal wd") || barisTeks.includes("withdraw")) {
          const matchAngka = barisTeks.match(/\d[\d,\.]*/g);
          if (matchAngka) {
            for (let a = 0; a < matchAngka.length; a++) {
              const bersih = parseFloat(matchAngka[a].replace(/,|\./g, ''));
              if (!isNaN(bersih) && bersih >= 10000) {
                nominalWD = bersih;
                break; // Ambil nilai nominal WD pertama yang ditemukan
              }
            }
          }
        }
        if (nominalWD > 0) break;
      }

      // Pengondisian Format berdasarkan Nominal WD:
      // 1. 100.000.000 ke atas -> A1 + A2 (A3 matikan)
      if (nominalWD >= 100000000) {
        adaWithdrawDiatas100Jt = true;
        adaWithdrawDiatas50Jt = false;
      } 
      // 2. 50.000.001 s/d 99.999.999 -> A1 + A3 (A2 matikan)
      else if (nominalWD >= 50000001 && nominalWD <= 99999999) {
        adaWithdrawDiatas100Jt = false;
        adaWithdrawDiatas50Jt = true;
      }

      return res.json({
        isiA1: isiA1,
        adaWithdrawDiatas100Jt: adaWithdrawDiatas100Jt,
        isiA2: isiA2 || isiA1,
        adaWithdrawDiatas50Jt: adaWithdrawDiatas50Jt,
        isiA3: isiA3 || isiA1
      });
    }

    return res.status(400).json({ error: 'Action tidak dikenal' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = app;
