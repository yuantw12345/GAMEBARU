require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Inisialisasi Google Auth menggunakan Service Account Credentials dari Environment Variables
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY
      ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Endpoint untuk Append Data (Format A1, A2, A3, dll)
app.post('/api/append', async (req, res) => {
  try {
    const { spreadsheetId, range, values } = req.body;
    const targetSpreadsheetId = spreadsheetId || SPREADSHEET_ID;

    if (!targetSpreadsheetId || !values) {
      return res.status(400).json({
        success: false,
        message: 'spreadsheetId dan values wajib diisi.',
      });
    }

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: targetSpreadsheetId,
      range: range || 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });

    return res.status(200).json({
      success: true,
      message: 'Data transaksi berhasil ditambahkan.',
      updates: response.data.updates,
    });
  } catch (error) {
    console.error('Error appending data:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint untuk Clear Data / Reset Range
app.post('/api/clear', async (req, res) => {
  try {
    const { spreadsheetId, range } = req.body;
    const targetSpreadsheetId = spreadsheetId || SPREADSHEET_ID;

    if (!targetSpreadsheetId || !range) {
      return res.status(400).json({
        success: false,
        message: 'spreadsheetId dan range wajib diisi.',
      });
    }

    const response = await sheets.spreadsheets.values.clear({
      spreadsheetId: targetSpreadsheetId,
      range: range,
    });

    return res.status(200).json({
      success: true,
      message: 'Range data berhasil dibersihkan.',
      clearedRange: response.data.clearedRange,
    });
  } catch (error) {
    console.error('Error clearing data:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Transaction API Server is running.');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
