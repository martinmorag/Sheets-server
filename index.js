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

/* app.post('/update-status', async (req, res) => {
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
}); */


app.get('/get-closers', async (req, res) => {
  try {
    const getRows = await sheets.spreadsheets.values.get({
      spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg',
      range: 'Llamadas',
    });

    const rows = getRows.data.values;
    if (rows.length) {
      const headerRow = rows[0];
      const closerIndex = headerRow.indexOf('Closer');

      if (closerIndex === -1) {
        return res.status(400).send('Closer column not found');
      }

      const closers = [...new Set(rows.slice(1).map(row => row[closerIndex]))];
      res.send({ closers });
    } else {
      res.status(404).send('No data found in the spreadsheet');
    }
  } catch (error) {
    res.status(500).send(error);
  }
});


app.get('/get-emails-by-closer', async (req, res) => {
  const { closer } = req.query;
  console.log('Received request to fetch emails for closer:', closer);

  try {
    const getRows = await sheets.spreadsheets.values.get({
      spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg',
      range: 'Llamadas',
    });

    const rows = getRows.data.values;
    if (rows.length) {
      const headerRow = rows[0];
      const closerIndex = headerRow.indexOf('Closer');
      const emailIndex = headerRow.indexOf('Email');

      if (closerIndex === -1 || emailIndex === -1) {
        console.error('Closer or Email column not found');
        return res.status(400).send('Closer or Email column not found');
      }

      const emails = rows.slice(1).filter(row => row[closerIndex] === closer).map(row => row[emailIndex]);
      res.send({ emails });
    } else {
      console.error('No data found in the spreadsheet');
      res.status(404).send('No data found in the spreadsheet');
    }
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).send(error);
  }
});



app.post('/update-status-email-by-closer', async (req, res) => {
  const { closer, email, status } = req.body;
  console.log('Received request to update status and email for closer:', closer, 'email:', email, 'to status:', status);

  try {
    const getRows = await sheets.spreadsheets.values.get({
      spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg',
      range: 'Llamadas',
    });

    const rows = getRows.data.values;
    if (rows.length > 0) {
      const headerRow = rows[0];
      const closerIndex = headerRow.indexOf('Closer');
      const emailIndex = headerRow.indexOf('Email');
      const statusIndex = headerRow.indexOf('Estado');
      const lastModifiedIndex = headerRow.indexOf('Ultima Modificacion');

      if (closerIndex === -1 || emailIndex === -1 || statusIndex === -1 || lastModifiedIndex === -1) {
        console.error('Closer, Email, Estado, or Ultima Modificacion column not found');
        return res.status(400).send('Closer, Email, Estado, or Ultima Modificacion column not found');
      }

      const now = new Date().toISOString();
      let found = false;

      // Iterate over each row to find the first row with the specified closer and email, then update it
      for (let i = 1; i < rows.length && !found; i++) {
        if (rows[i][closerIndex] === closer && rows[i][emailIndex] === email) {
          const rangeStatus = `Llamadas!${String.fromCharCode(65 + statusIndex)}${i + 1}`;
          const rangeLastModified = `Llamadas!${String.fromCharCode(65 + lastModifiedIndex)}${i + 1}`;
          const rangeEmail = `Llamadas!${String.fromCharCode(65 + emailIndex)}${i + 1}`;

          console.log('Updating range:', rangeStatus, 'with status:', status);
          console.log('Updating range:', rangeLastModified, 'with last modified:', now);
          console.log('Updating range:', rangeEmail, 'with email:', email);

          await sheets.spreadsheets.values.update({
            spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg',
            range: rangeStatus,
            valueInputOption: 'RAW',
            resource: {
              values: [[status]],
            },
          });

          await sheets.spreadsheets.values.update({
            spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg',
            range: rangeLastModified,
            valueInputOption: 'RAW',
            resource: {
              values: [[now]],
            },
          });

          await sheets.spreadsheets.values.update({
            spreadsheetId: '1VDdVK85wMlxNbI279gsx3qLJGGyeUOuC0nXNEfnSLgg',
            range: rangeEmail,
            valueInputOption: 'RAW',
            resource: {
              values: [[email]],
            },
          });

          found = true; // Mark as found to stop iterating further
        }
      }

      if (!found) {
        console.error('No rows found for closer:', closer, 'and email:', email);
        return res.status(404).send('No rows found for closer and email');
      }

      console.log('Status, Email, and Last Modified updated successfully for closer:', closer);
      res.send({ status: 'success' });
    } else {
      console.error('No data found in the spreadsheet');
      res.status(404).send('No data found in the spreadsheet');
    }
  } catch (error) {
    console.error('Error updating status and email:', error);
    res.status(500).send(error.message || error.toString());
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
