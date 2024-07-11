require('dotenv').config()
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

const { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;

const auth = new google.auth.JWT(
  GOOGLE_CLIENT_EMAIL,
  null,
  GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),  // Handle newlines in environment variables
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

app.post('/update-status', async (req, res) => {
  const { email, status } = req.body;
  console.log('Received request:', req.body); // Log received request

  try {
    const getRows = await sheets.spreadsheets.values.get({
      spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg',
      range: 'Llamadas',
    });

    const rows = getRows.data.values;
    if (rows.length) {
      const headerRow = rows[0];
      const emailIndex = headerRow.indexOf('Email');
      const statusIndex = headerRow.indexOf('Estado');
      const lastModifiedIndex = headerRow.indexOf('Ultima Modificacion'); // New column index

      console.log('Headers:', headerRow);

      if (emailIndex === -1 || statusIndex === -1 || lastModifiedIndex === -1) {
        console.error('Email, Estado, or Ultima Modificacion column not found');
        return res.status(400).send('Email, Estado, or Ultima Modificacion column not found');
      }

      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][emailIndex] === email) {
          rowIndex = i;
          break;
        }
      }

      if (rowIndex === -1) {
        console.error('Email not found:', email);
        return res.status(404).send('Email not found');
      }

      // Update the status and last modified date for the found row
      const now = new Date().toISOString();
      const rangeStatus = `Llamadas!${String.fromCharCode(65 + statusIndex)}${rowIndex + 1}`;
      const rangeLastModified = `Llamadas!${String.fromCharCode(65 + lastModifiedIndex)}${rowIndex + 1}`;
      console.log('Updating range:', rangeStatus, 'with status:', status);
      console.log('Updating range:', rangeLastModified, 'with last modified:', now);

      const updateStatus = sheets.spreadsheets.values.update({
        spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg',
        range: rangeStatus,
        valueInputOption: 'RAW',
        resource: {
          values: [[status]],
        },
      });

      const updateLastModified = sheets.spreadsheets.values.update({
        spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg',
        range: rangeLastModified,
        valueInputOption: 'RAW',
        resource: {
          values: [[now]],
        },
      });

      await Promise.all([updateStatus, updateLastModified]);
      console.log('Status and Last Modified updated successfully');
      res.send({ status: 'success' });
    } else {
      console.error('No data found in the spreadsheet');
      res.status(404).send('No data found in the spreadsheet');
    }
  } catch (error) {
    console.error('Error updating status:', error); // Log the error
    res.status(500).send(error);
  }
});



app.get('/latest-changes', async (req, res) => {
  const { limit = 10 } = req.query; // Default limit to 10, can be overridden

  try {
    const getRows = await sheets.spreadsheets.values.get({
      spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg',
      range: 'Llamadas',
    });

    const rows = getRows.data.values;
    if (!rows || rows.length === 0) {
      console.error('No data found in the spreadsheet');
      return res.status(404).send('No data found in the spreadsheet');
    }

    // Find the index of the Ultima Modificacion column
    const headerRow = rows[0];
    const lastModifiedIndex = headerRow.indexOf('Ultima Modificacion'); // Replace with your actual column header

    if (lastModifiedIndex === -1) {
      console.error('Ultima Modificacion column not found');
      return res.status(400).send('Ultima Modificacion column not found');
    }

    const latestChanges = rows
      .slice(1) // Exclude header row
      .map(row => ({
        row,
        date: new Date(row[lastModifiedIndex]),
      }))
      .filter(item => !isNaN(item.date.getTime())) // Filter out invalid dates
      .sort((a, b) => b.date - a.date) // Sort by Ultima Modificacion
      .slice(0, limit) // Apply limit
      .map(item => item.row); // Extract rows

    res.send([headerRow, ...latestChanges]); // Include header row for consistency
  } catch (error) {
    console.error('Error fetching latest changes:', error);
    res.status(500).send('Error fetching latest changes');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});