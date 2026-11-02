const express = require('express');
const { google } = require('googleapis');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Konfigurasi Google Sheets API menggunakan Service Account dari Vercel Env Vars
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Endpoint Utama /api
app.all('/api', async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Mengambil payload dari GET (query) atau POST (body)
    const body = req.method === 'POST' ? req.body : req.query;
    const action = body.action;

    // 1. LOGIKA: cek_bot (Membaca baris dengan status 'BOT' dari Sheet1)
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
            bank: data[i][0] || '',      // Kolom A
            nominal: data[i][1] || '',   // Kolom B
            no_rek: data[i][3] || ''     // Kolom D
          });
        }
      }
      return res.json(antrean);
    } 

    // 2. LOGIKA: update_status (Mengubah status di Kolom E baris tertentu)
    else if (action === 'update_status') {
      const row = body.row;
      const status = body.status;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Sheet1!E${row}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[status]]
        }
      });
      return res.send('OK');
    }

    // 3. LOGIKA: appendSheet / Kirim Transaksi (Menambahkan baris baru ke Tab yang dipilih)
    else if (action === 'appendSheet') {
      const text = body.text;
      const sheetName = body.sheetName || 'GRUPING 1';

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[text]]
        }
      });
      return res.json({ success: true });
    }

    // 4. LOGIKA: clearSheet / Hapus Teks & Data di Tab tertentu
    else if (action === 'clearSheet') {
      const sheetName = body.sheetName || 'GRUPING 1';

      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });
      return res.json({ success: true });
    }

    // 5. LOGIKA: getFormat / Ambil Format Hasil untuk Modal Pop-up
    else if (action === 'getFormat') {
      const sheetName = body.sheetName || 'GRUPING 1';
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:C10`,
      });
      const rows = response.data.values || [];

      // Contoh pengambilan sel sesuai struktur format spreadsheet Anda (A1, A2, A3)
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
    console.error('Error handling API:', error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
