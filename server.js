require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Create an async pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// Helper to convert DB rows to our JS object standard
const mapUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  password: row.password,
  role: row.role,
  department: row.department,
  avatar: row.avatar,
  joinDate: row.join_date,
  managerId: row.manager_id
});

const mapBalance = (row) => ({
  userId: row.user_id,
  vacation: { total: row.vacation_total, used: row.vacation_used, pending: row.vacation_pending },
  sick: { total: row.sick_total, used: row.sick_used, pending: row.sick_pending },
  personal: { total: row.personal_total, used: row.personal_used, pending: row.personal_pending },
  unpaid: { total: 999, used: 0, pending: 0 } // Unlimited unpaid logic
});

const mapLeave = (row) => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  startDate: row.start_date,
  endDate: row.end_date,
  days: row.days,
  reason: row.reason,
  status: row.status,
  managerId: row.manager_id,
  managerComment: row.manager_comment,
  appliedDate: row.applied_date,
  actionDate: row.action_date
});

const mapNotification = (row) => ({
  id: row.id,
  userId: row.user_id,
  message: row.message,
  read: !!row.is_read,
  date: row.created_at,
  type: row.type
});

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

// TEST ROUTE
app.get('/api/test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS solution');
    res.json({ message: 'DB Connected successfully', result: rows[0].solution });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
    if (users.length > 0) {
      res.json({ success: true, user: mapUser(users[0]) });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET USERS
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    res.json(rows.map(mapUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE USER
app.put('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  const updates = req.body;
  try {
    if (updates.name && updates.email) {
      let query = 'UPDATE users SET name = ?, email = ?';
      const params = [updates.name, updates.email];
      if (updates.password) {
        query += ', password = ?';
        params.push(updates.password);
      }
      query += ' WHERE id = ?';
      params.push(userId);
      await pool.query(query, params);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Missing logic' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL BALANCES
app.get('/api/balances', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM balances');
    res.json(rows.map(mapBalance));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL LEAVES
app.get('/api/leaves', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM leaves');
    res.json(rows.map(mapLeave));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SUBMIT LEAVE
app.post('/api/leaves', async (req, res) => {
  const { userId, type, startDate, endDate, days, reason, managerId } = req.body;
  const appliedDate = new Date().toISOString().split('T')[0];
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Insert leave
    const [result] = await conn.query(
      `INSERT INTO leaves (user_id, type, start_date, end_date, days, reason, manager_id, applied_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, type, startDate, endDate, days, reason, managerId, appliedDate]
    );

    // 2. Update branch pending balance if not unpaid
    if (type !== 'unpaid') {
      await conn.query(
        `UPDATE balances SET ${type}_pending = ${type}_pending + ? WHERE user_id = ?`,
        [days, userId]
      );
    }

    // 3. Notify manager
    const [userRows] = await conn.query('SELECT name FROM users WHERE id = ?', [userId]);
    const empName = userRows.length ? userRows[0].name : 'An employee';
    await conn.query(
      `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'info')`,
      [managerId, `New ${type} leave request from ${empName}.`]
    );

    await conn.commit();
    res.json({ success: true, leaveId: result.insertId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// ACTION LEAVE (Approve/Reject)
app.put('/api/leaves/:id/action', async (req, res) => {
  const leaveId = req.params.id;
  const { action, managerComment, managerId } = req.body; // action: 'approved' | 'rejected'
  const actionDate = new Date().toISOString().split('T')[0];
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Get current leave details
    const [leaveRows] = await conn.query('SELECT * FROM leaves WHERE id = ?', [leaveId]);
    if (!leaveRows.length) throw new Error('Leave not found');
    const leave = leaveRows[0];
    
    if (leave.status !== 'pending') throw new Error('Leave is no longer pending');

    // 1. Update Leave Status
    await conn.query(
      `UPDATE leaves SET status = ?, manager_comment = ?, action_date = ? WHERE id = ?`,
      [action, managerComment || '', actionDate, leaveId]
    );

    // 2. Adjust Balance
    if (leave.type !== 'unpaid') {
      // Free up pending balance
      await conn.query(
        `UPDATE balances SET ${leave.type}_pending = GREATEST(0, ${leave.type}_pending - ?) WHERE user_id = ?`,
        [leave.days, leave.user_id]
      );
      // If approved, add to used
      if (action === 'approved') {
        await conn.query(
          `UPDATE balances SET ${leave.type}_used = ${leave.type}_used + ? WHERE user_id = ?`,
          [leave.days, leave.user_id]
        );
      }
    }

    // 3. Notify Employee
    const msg = action === 'approved'
      ? `Your ${leave.type} leave (${leave.days} days) was approved.`
      : `Your ${leave.type} leave was rejected. ${managerComment ? 'Reason: ' + managerComment : ''}`;
    
    await conn.query(
      `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)`,
      [leave.user_id, msg, action === 'approved' ? 'success' : 'error']
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// GET NOTIFICATIONS
app.get('/api/notifications', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
    res.json(rows.map(mapNotification));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MARK NOTIFICATIONS READ
app.put('/api/notifications/read/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE', [userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Start server
app.listen(PORT, () => {
  console.log('----------------------------------------------------');
  console.log(`🚀 LeaveSync API Server running on http://localhost:${PORT}`);
  console.log('----------------------------------------------------');
});
