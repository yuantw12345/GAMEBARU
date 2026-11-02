const express = require('express');
const { google } = require('googleapis');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Konfigurasi Google Sheets API menggunakan Service Account dari Environment Variables
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Endpoint utama yang meniru logika doGet(e) di Google Apps Script
app.get('/api', async (req, res) => {
  try {
    const action = req.query.action;
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // 1. Logika untuk action == "cek_bot"
    if (action === 'cek_bot') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Sheet1!A:E',
      });
      const data = response.data.values || [];
      const antrean = [];

      // Perulangan mulai dari baris index 1 (baris ke-2 di Sheet, melewati header)
      for (let i = 1; i < data.length; i++) {
        const status = data[i][4] ? String(data[i][4]).trim().toUpperCase() : '';
        
        if (status === 'BOT') {
          antrean.push({
            row: i + 1,
            bank: data[i][0] || '',      // Kolom A: Jenis Bank
            nominal: data[i][1] || '',   // Kolom B: Nominal
            no_rek: data[i][3] || ''     // Kolom D: Nomor Rekening
          });
        }
      }
      return res.json(antrean);
    } 
    
    // 2. Logika untuk action == "update_status"
    else if (action === 'update_status') {
      const row = req.query.row;
      const status = req.query.status;

      // Mengubah status kembali ke Kolom E (kolom ke-5) pada baris tertentu
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

    return res.status(400).send('Action tidak dikenal');
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).send({ error: error.message });
  }
});

// Port untuk Vercel / Local
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
