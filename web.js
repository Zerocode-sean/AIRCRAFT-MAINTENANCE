const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const port = 3001;

// MySQL connection configuration
const dbConfig = {
    host: 'localhost',
    user: 'root', // Replace with your MySQL username
    password: '', // Replace with your MySQL password
    database: 'preflight1'
};

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for JSON parsing
app.use(express.json());

// API endpoint to fetch all issues
app.get('/issues', async (req, res) => {
    const { aircraft_id, status } = req.query;
    let query = `
        SELECT mi.id, a.name AS aircraft_name, mi.issue_text, mi.reported_by, mi.reported_at, mi.status
        FROM maintenance_issues mi
        LEFT JOIN aircraft a ON mi.aircraft_id = a.id
    `;
    const params = [];
    if (aircraft_id || status) {
        query += ' WHERE';
        if (aircraft_id) {
            query += ' mi.aircraft_id = ?';
            params.push(aircraft_id);
        }
        if (status) {
            query += aircraft_id ? ' AND mi.status = ?' : ' mi.status = ?';
            params.push(status);
        }
    }
    query += ' ORDER BY mi.reported_at DESC';

    try {
        const db = await mysql.createConnection(dbConfig);
        const [issues] = await db.query(query, params);
        await db.end();
        res.json(issues);
    } catch (error) {
        console.error('Error fetching issues:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to update issue status
app.post('/issues/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['open', 'in_progress', 'resolved'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    try {
        const db = await mysql.createConnection(dbConfig);
        const [result] = await db.query('UPDATE maintenance_issues SET status = ? WHERE id = ?', [status, id]);
        await db.end();
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Issue not found' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to fetch aircraft for filtering
app.get('/aircraft', async (req, res) => {
    try {
        const db = await mysql.createConnection(dbConfig);
        const [aircraft] = await db.query('SELECT id, name FROM aircraft');
        await db.end();
        res.json(aircraft);
    } catch (error) {
        console.error('Error fetching aircraft:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Web server running on http://localhost:${port}`);
});