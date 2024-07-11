const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

const credentialsPath = path.join(__dirname, 'credentials.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath));
const { client_email, private_key } = credentials;
const auth = new google.auth.JWT(
  client_email,
  null,
  private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

// Update lead status
app.post('/update-status', async (req, res) => {
    const { email, status } = req.body;
    console.log('Received request:', req.body); // Log received request
  
    try {
      // Read the data from the spreadsheet
      const getRows = await sheets.spreadsheets.values.get({
        spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg', // Replace with your spreadsheet ID
        range: 'Llamadas', // Replace with your actual sheet name
      });
  
      const rows = getRows.data.values;
      if (rows && rows.length > 0) {
        const headers = rows[0];
        console.log('Headers:', headers); // Log headers to verify
  
        const emailIndex = headers.indexOf('Email');
        const statusIndex = headers.indexOf('Estado');
  
        if (emailIndex === -1 || statusIndex === -1) {
          return res.status(400).send('Email or Status column not found');
        }
  
        let rowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][emailIndex] === email) {
            rowIndex = i;
            break;
          }
        }
  
        if (rowIndex === -1) {
          return res.status(404).send('Email not found');
        }
  
        // Update the status for the found row
        const range = `Llamadas!${String.fromCharCode(65 + statusIndex)}${rowIndex + 1}`;
        console.log('Updating range:', range, 'with status:', status); // Log update details
  
        const response = await sheets.spreadsheets.values.update({
          spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg',
          range: range,
          valueInputOption: 'RAW',
          resource: {
            values: [[status]],
          },
        });
  
        res.send(response.data);
      } else {
        res.status(404).send('No data found in the spreadsheet');
      }
    } catch (error) {
      console.error('Error updating status:', error); // Log the error
      res.status(500).send(error);
    }
});

app.get('/latest-changes', async (req, res) => {
    const { sinceTimestamp, limit = 10 } = req.query; // Default limit to 10, can be overridden
  
    try {
      const getRows = await sheets.spreadsheets.values.get({
        spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg',
        range: 'Llamadas',
      });
  
      const rows = getRows.data.values;
      if (!rows || rows.length === 0) {
        return res.status(404).send('No data found in the spreadsheet');
      }
  
      // Find the index of the LastModified column
      const headerRow = rows[0];
      const lastModifiedIndex = headerRow.indexOf('LastModified'); // Replace with your actual column header
  
      if (lastModifiedIndex === -1) {
        return res.status(400).send('LastModified column not found');
      }
  
      const latestChanges = rows
        .filter(row => {
            const lastModified = row[lastModifiedIndex]; // Accessing the LastModified column
            // Compare lastModified with sinceTimestamp
            return new Date(lastModified) > new Date(sinceTimestamp);
        })
        .slice(0, limit); // Apply limit here
  
      res.send(latestChanges);
    } catch (error) {
      console.error('Error fetching latest changes:', error);
      res.status(500).send('Error fetching latest changes');
    }
});
  
  
  

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});