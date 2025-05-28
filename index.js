const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const AfricasTalking = require('africastalking')({
    apiKey: 'atsk_4405b002219a6eadbcb59274335298e2b6a997502304ccb63684c726bca3f70f8632c0f5', // Replace with your Africa's Talking API key
    username: 'sandbox'     // Replace with your Africa's Talking username
});

const app = express();
const port = 3001;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// MySQL connection
const dbConfig = {
    host: 'localhost',
    user: 'root', // Replace with your MySQL username
    password: '', // Replace with your MySQL password
    database: 'preflight1'
};

// USSD endpoint
app.post('/ussd', async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    let response = '';

    try {
        const db = await mysql.createConnection(dbConfig);

        // Split user input to handle menu navigation
        const input = text.split('*');
        const lastInput = input[input.length - 1];

        if (text === '') {
            // Main menu
            response = 'CON Welcome to Aircraft Maintenance Reporting\n';
            response += '1. Report an Issue\n';
            response += '0. Exit';
        } else if (text === '1') {
            // Fetch aircraft list
            const [aircraft] = await db.query('SELECT id, name FROM aircraft');
            response = 'CON Select Aircraft\n';
            aircraft.forEach((a, index) => {
                response += `${index + 1}. ${a.name}\n`;
            });
            response += '0. Back';
        } else if (input[0] === '1' && input.length === 2 && lastInput !== '0') {
            // Store selected aircraft and prompt for issue description
            const aircraftIndex = parseInt(lastInput) - 1;
            const [aircraft] = await db.query('SELECT id, name FROM aircraft');
            if (aircraftIndex >= 0 && aircraftIndex < aircraft.length) {
                const aircraftId = aircraft[aircraftIndex].id;
                await db.query('INSERT INTO maintenance_issues (aircraft_id, reported_by) VALUES (?, ?)', [aircraftId, phoneNumber]);
                response = 'CON Enter issue description:';
            } else {
                response = 'END Invalid selection. Try again.';
            }
        } else if (input[0] === '1' && input.length === 3) {
            // Save issue description
            const aircraftIndex = parseInt(input[1]) - 1;
            const [aircraft] = await db.query('SELECT id FROM aircraft');
            if (aircraftIndex >= 0 && aircraftIndex < aircraft.length) {
                const aircraftId = aircraft[aircraftIndex].id;
                await db.query(
                    'UPDATE maintenance_issues SET issue_text = ?, status = ? WHERE aircraft_id = ? AND reported_by = ? AND issue_text IS NULL',
                    [lastInput, 'open', aircraftId, phoneNumber]
                );
                response = 'END Issue reported successfully!';
            } else {
                response = 'END Invalid selection.';
            }
        } else if (text === '0') {
            // Exit
            response = 'END Thank you for using Aircraft Maintenance Reporting.';
        } else {
            response = 'END Invalid input. Try again.';
        }

        await db.end();
    } catch (error) {
        console.error('Error:', error);
        response = 'END Error occurred. Please try again.';
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});