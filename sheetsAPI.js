const { google } = require('googleapis');
const { oauth2Client } = require('./auth');  // Ensure this path matches where your OAuth2 client is configured

const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

async function readSheet(sheetId, range) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });
    return response.data.values;
  } catch (err) {
    console.error('The API returned an error: ' + err);
    return [];
  }
}

module.exports = { readSheet };
