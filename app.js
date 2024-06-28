require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { oauth2Client, getAuthUrl, getTokens } = require('./auth');

const app = express();
const PORT = 3000;

// Setting up the view engine and body parser
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Route to initiate OAuth process
app.get('/', (req, res) => {
    const url = getAuthUrl();
    res.send(`<a href="${url}">Authorize Google Sheets Access</a>`);
});

// OAuth callback route
app.get('/oauth2callback', async (req, res) => {
    const { code } = req.query;
    try {
        const tokens = await getTokens(code);
        oauth2Client.setCredentials(tokens);  
        res.redirect('/sheet?page=1'); // Redirect to the first page of the sheet view
    } catch (error) {
        console.error('Error getting tokens:', error);
        res.send('Failed to authenticate');
    }
});

// Route to display sheet data with pagination
app.get('/sheet', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const rowsPerPage = 50;
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    try {
        // Check total number of rows dynamically with a simple and sure range
        const totalRowsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: '1qr2JH42OyROlST_pQR-50n0Hh77xao9mByohINfJDjQ',  // Make sure this is correct
            range: 'Sheet1!A2:A', // Start from the second row
        });
        const totalRows = totalRowsResponse.data.values.length + 1; // Add 1 to account for the skipped header row

        // Calculate the range to fetch based on current page
        const startRow = (page - 1) * rowsPerPage + 2; // Start from row 2
        const endRow = startRow + rowsPerPage - 1;
        const range = `Sheet1!A${startRow}:L${endRow}`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: '1qr2JH42OyROlST_pQR-50n0Hh77xao9mByohINfJDjQ',
            range: range,
        });

        // Calculate the number of pages
        const numPages = Math.ceil(totalRows / rowsPerPage);

        // Render the page with the fetched data
        res.render('index', { data: response.data.values, currentPage: page, numPages: numPages });
    } catch (error) {
        console.error('Failed to retrieve data from Google Sheets:', error);
        res.send('Failed to retrieve data');
    }
});

// Route to handle form submissions and update the Google Sheet
app.post('/update', async (req, res) => {
    const data = req.body;
    const updates = [];
    const sheetId = '1qr2JH42OyROlST_pQR-50n0Hh77xao9mByohINfJDjQ'; // Make sure to use the correct ID
    const range = `Sheet1`;  // Assuming you want to update this entire sheet or adjust as needed

    for (let key in data) {
        if (data.hasOwnProperty(key)) {
            // Extract row and column index from the input name (e.g., R1C1 -> Row 1, Column 1)
            const match = key.match(/R(\d+)C(\d+)/);
            if (match) {
                const rowIndex = parseInt(match[1]);
                const colIndex = parseInt(match[2]);
                updates.push({
                    range: `${range}!${String.fromCharCode(65 + colIndex)}${rowIndex + 2}`, // Add 2 to skip the header row
                    values: [[data[key]]]
                });
            }
        }
    }

    // Google Sheets API call to batch update values
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    try {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: sheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: updates
            }
        });
        res.redirect('/sheet?page=1'); // Redirect back to the first page or as needed
    } catch (error) {
        console.error('Failed to update Google Sheets:', error);
        res.send('Failed to update data');
    }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
