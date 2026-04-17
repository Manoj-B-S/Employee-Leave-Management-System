# 📅 LeaveSync — Employee Leave Management System

A fully functional, premium-designed **Employee Leave Management System** built with pure HTML, CSS, and JavaScript. No frameworks. No backend required — uses localStorage as a simulated database.

---

## 🚀 How to Run

1. Open the `leave-management` folder
2. Double-click **`index.html`** — it opens directly in your browser
3. Use any demo account to log in instantly

> ✅ No installation, no server, no dependencies needed!

---
## 📸 Screenshots
🔐 Login Page
<img width="642" height="817" alt="Screenshot 2026-04-17 105958" src="https://github.com/user-attachments/assets/01126d10-401b-4b20-874c-038654643f84" />
---
🧑‍💼 Admin Dashboard
<img width="1880" height="821" alt="Screenshot 2026-04-17 105732" src="https://github.com/user-attachments/assets/84ac945a-82fd-49a3-9d9f-c066b6e0b9d2" />
---
👨‍💻 Employee Dashboard
<img width="1875" height="715" alt="Screenshot 2026-04-17 110033" src="https://github.com/user-attachments/assets/0a5e5ea2-d93e-4918-8c1a-a02b3b95b713" />
---
👥 Team Overview
<img width="1896" height="724" alt="Screenshot 2026-04-17 110114" src="https://github.com/user-attachments/assets/387bb815-9532-459e-824b-4de18f7848e2" />
---
## 🔐 Demo Accounts

| Name | Email | Password | Role |
|---|---|---|---|
| Admin Manager | admin@company.com | admin123 | Manager (HR) |
| Sarah Johnson | sarah@company.com | pass123 | Manager (Engineering) |
| John Smith | john@company.com | pass123 | Employee (Engineering) |
| Emily Davis | emily@company.com | pass123 | Employee (Marketing) |
| Michael Brown | michael@company.com | pass123 | Employee (Sales) |
| Jessica Wilson | jessica@company.com | pass123 | Employee (Engineering) |
| David Martinez | david@company.com | pass123 | Employee (HR) |
| Amanda Taylor | amanda@company.com | pass123 | Employee (Finance) |
| Robert Anderson | robert@company.com | pass123 | Employee (Sales) |
| Laura Thomas | laura@company.com | pass123 | Employee (Marketing) |

---

## ✨ Features

### 🔐 Authentication
- Secure login with email + password
- Role-based access control (Manager vs Employee)
- Session management via sessionStorage
- Auto-redirect if already logged in

### 👤 Employee Features
- **Dashboard** — Stats (total, pending, approved, rejected), leave balances, quick apply
- **Apply for Leave** — Form with validation, working days calculator, balance check
- **My Requests** — View all leave history with status and manager comments
- **Leave Calendar** — Visual calendar showing own leave schedule
- **Profile** — Edit name, email, and password

### 👔 Manager Features
- **Manager Dashboard** — Team stats, pending approvals table, mini team overview
- **Team Requests** — Full table with filter tabs (All / Pending / Approved / Rejected)
- **Approve / Reject** — Modal with comment field, updates balances automatically
- **Leave Calendar** — Full company calendar with all team leaves visualized
- **Team Overview** — Detailed cards per employee with balances and progress bars
- **Profile** — Edit own account details

### 📋 Leave Types & Balances
| Type | Default Days |
|---|---|
| 🏖️ Vacation | 15 days/year |
| 🏥 Sick Leave | 10 days/year |
| 👤 Personal | 5 days/year |
| 💼 Unpaid | Unlimited |

### 🔔 Notifications
- Real-time notification bell with unread count badge
- Employees notified when leave is approved/rejected
- Managers notified on new leave requests
- Auto mark-as-read when panel is opened

### 📅 Calendar
- Month navigation (prev/next)
- Color-coded dots per leave type
- Employee avatars visible on leave days
- Click any date to see who's on leave (tooltip panel)
- Shows pending (amber) and approved (green) leaves

---

## 📁 File Structure

```
leave-management/
├── index.html          ← Login page
├── dashboard.html      ← Main SPA after login
├── css/
│   ├── main.css        ← Full design system (1500+ lines)
│   └── login.css       ← Login page styles with animations
└── js/
    ├── db.js           ← localStorage database layer (simulates MySQL)
    ├── auth.js         ← Authentication & session management
    ├── calendar.js     ← Calendar rendering component
    └── app.js          ← App controller + all view templates (900+ lines)
```

---

## 🛠️ Tech Stack

| Technology | Usage |
|---|---|
| **HTML5** | Semantic structure, SPA layout |
| **CSS3** | Dark theme, glassmorphism, animations, responsive |
| **JavaScript (ES6+)** | All logic, routing, DOM rendering |
| **localStorage** | Persistent data storage (simulates MySQL) |
| **sessionStorage** | Session/auth management |
| **Google Fonts** | Inter font for premium typography |

---

## 🎨 Design Highlights

- **Dark Mode** — Deep navy/purple theme (`#0f0f1a` base)
- **Glassmorphism** — Frosted glass login card with blur effect
- **Animated Background** — Floating gradient orbs on login page
- **Micro-animations** — Fade transitions between views, hover effects
- **Color System** — Consistent HSL-based palette
- **Responsive** — Works on mobile, tablet, and desktop
- **Toast Notifications** — Bottom-right animated toasts
- **Progress Bars** — Visual leave balance indicators

---

## 🔄 How Data Flows (Simulated MySQL)

```
Employee submits leave
  → DB.submitLeave() stores in localStorage
  → Balance updated (pending++)
  → Manager notified

Manager approves/rejects
  → DB.actionLeave() updates status
  → Balance recalculated (pending--, used++ if approved)
  → Employee notified
```

---

## 📱 Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| > 1100px | Full 4-column stats, 4-column balances |
| 768px–1100px | 2-column stats, 2-column balances |
| < 768px | Mobile — sidebar toggles, stacked layout |

---

*Built with ❤️ using HTML, CSS & JavaScript*
