CREATE DATABASE IF NOT EXISTS leave_sync;
USE leave_sync;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('manager', 'employee') NOT NULL,
    department VARCHAR(50),
    avatar VARCHAR(2) NOT NULL,
    manager_id INT NULL,
    join_date DATE NOT NULL,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Leave Balances Table
CREATE TABLE IF NOT EXISTS balances (
    user_id INT PRIMARY KEY,
    vacation_total INT DEFAULT 15,
    vacation_used INT DEFAULT 0,
    vacation_pending INT DEFAULT 0,
    sick_total INT DEFAULT 10,
    sick_used INT DEFAULT 0,
    sick_pending INT DEFAULT 0,
    personal_total INT DEFAULT 5,
    personal_used INT DEFAULT 0,
    personal_pending INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Leave Requests Table
CREATE TABLE IF NOT EXISTS leaves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('vacation', 'sick', 'personal', 'unpaid') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days INT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    manager_id INT NOT NULL,
    manager_comment TEXT,
    applied_date DATE NOT NULL,
    action_date DATE NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES users(id)
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    type ENUM('success', 'error', 'info', 'warning') DEFAULT 'info',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Delete existing content for fresh setup
DELETE FROM notifications;
DELETE FROM leaves;
DELETE FROM balances;
DELETE FROM users;

-- Seed Data: Users
-- Since these are all inserted at once, their IDs will be auto-generated sequentially starting at 1.
INSERT INTO users (name, email, password, role, department, avatar, manager_id, join_date) VALUES 
('Admin Manager', 'admin@company.com', 'admin123', 'manager', 'HR', 'AM', NULL, '2020-01-01'),           -- ID 1
('Sarah Johnson', 'sarah@company.com', 'pass123', 'manager', 'Engineering', 'SJ', NULL, '2019-06-15'),   -- ID 2
('John Smith', 'john@company.com', 'pass123', 'employee', 'Engineering', 'JS', 2, '2021-03-10'),         -- ID 3
('Emily Davis', 'emily@company.com', 'pass123', 'employee', 'Marketing', 'ED', 1, '2021-07-22'),         -- ID 4
('Michael Brown', 'michael@company.com', 'pass123', 'employee', 'Sales', 'MB', 1, '2022-01-05'),         -- ID 5
('Jessica Wilson', 'jessica@company.com', 'pass123', 'employee', 'Engineering', 'JW', 2, '2022-04-18'),  -- ID 6
('David Martinez', 'david@company.com', 'pass123', 'employee', 'HR', 'DM', 1, '2020-11-30'),             -- ID 7
('Amanda Taylor', 'amanda@company.com', 'pass123', 'employee', 'Finance', 'AT', 1, '2023-02-14'),        -- ID 8
('Robert Anderson', 'robert@company.com', 'pass123', 'employee', 'Sales', 'RA', 1, '2021-09-01'),        -- ID 9
('Laura Thomas', 'laura@company.com', 'pass123', 'employee', 'Marketing', 'LT', 1, '2023-05-20');        -- ID 10

-- Seed Data: Balances
INSERT INTO balances (user_id) VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10);

-- Seed Data: Existing Leaves
INSERT INTO leaves (user_id, type, start_date, end_date, days, reason, status, manager_id, manager_comment, applied_date, action_date) VALUES
(3, 'vacation', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL 18 DAY), 3, 'Family vacation trip', 'approved', 2, 'Enjoy your vacation!', DATE_SUB(CURDATE(), INTERVAL 25 DAY), DATE_SUB(CURDATE(), INTERVAL 24 DAY)),
(4, 'sick', DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_SUB(CURDATE(), INTERVAL 9 DAY), 2, 'Flu and fever', 'approved', 1, 'Get well soon!', DATE_SUB(CURDATE(), INTERVAL 11 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
(5, 'personal', DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_SUB(CURDATE(), INTERVAL 5 DAY), 1, 'Personal errand', 'rejected', 1, 'Busy period, reschedule', DATE_SUB(CURDATE(), INTERVAL 7 DAY), DATE_SUB(CURDATE(), INTERVAL 6 DAY)),
(6, 'vacation', DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 9 DAY), 5, 'Annual leave to visit parents', 'pending', 2, NULL, DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
(3, 'sick', DATE_SUB(CURDATE(), INTERVAL 3 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY), 2, 'Doctor appointment and recovery', 'approved', 2, 'Approved.', DATE_SUB(CURDATE(), INTERVAL 4 DAY), DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
(7, 'personal', DATE_ADD(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 3 DAY), 1, 'Bank and legal matter', 'pending', 1, NULL, DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
(8, 'vacation', DATE_ADD(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 14 DAY), 5, 'Summer holiday trip', 'pending', 1, NULL, DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
(9, 'sick', DATE_SUB(CURDATE(), INTERVAL 1 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), 1, 'Headache and fever', 'approved', 1, 'Take rest.', DATE_SUB(CURDATE(), INTERVAL 2 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
(10, 'vacation', DATE_ADD(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 24 DAY), 5, 'International travel', 'pending', 1, NULL, CURDATE(), NULL);

-- Adjust balances for the approved and pending leaves
UPDATE balances SET vacation_used = vacation_used + 3 WHERE user_id = 3;
UPDATE balances SET sick_used = sick_used + 2 WHERE user_id = 4;
UPDATE balances SET vacation_pending = vacation_pending + 5 WHERE user_id = 6;
UPDATE balances SET sick_used = sick_used + 2 WHERE user_id = 3;
UPDATE balances SET personal_pending = personal_pending + 1 WHERE user_id = 7;
UPDATE balances SET vacation_pending = vacation_pending + 5 WHERE user_id = 8;
UPDATE balances SET sick_used = sick_used + 1 WHERE user_id = 9;
UPDATE balances SET vacation_pending = vacation_pending + 5 WHERE user_id = 10;

-- Seed Data: Notifications
INSERT INTO notifications (user_id, message, is_read, type) VALUES
(3, 'Your vacation leave (3 days) was approved.', FALSE, 'success'),
(4, 'Your sick leave (2 days) was approved.', TRUE, 'success'),
(5, 'Your personal leave was rejected.', FALSE, 'error'),
(2, 'New leave request from Jessica Wilson.', FALSE, 'info'),
(1, 'New leave request from David Martinez.', FALSE, 'info'),
(3, 'Your sick leave (2 days) was approved.', FALSE, 'success');
