// ============================================================
// APP.JS — Main Application Controller
// ============================================================

const App = {
  currentView: 'dashboard',
  currentUser: null,

  async init() {
    await DB.init();
    if (!Auth.requireAuth()) return;
    this.currentUser = Auth.currentUser();
    this.setupLayout();
    await this.navigate('dashboard');
    this.startNotifPoll();
  },

  setupLayout() {
    const u = this.currentUser;
    // Avatar & name in sidebar
    document.getElementById('sb-avatar').textContent  = u.avatar;
    document.getElementById('sb-name').textContent    = u.name;
    document.getElementById('sb-role').textContent    = u.role.charAt(0).toUpperCase() + u.role.slice(1);
    document.getElementById('hdr-avatar').textContent = u.avatar;
    document.getElementById('hdr-name').textContent   = u.name;

    // Show/hide manager-only nav items
    document.querySelectorAll('.nav-manager').forEach(el => {
      el.style.display = Auth.isManager() ? 'flex' : 'none';
    });
    document.querySelectorAll('.nav-employee').forEach(el => {
      el.style.display = Auth.isEmployee() ? 'flex' : 'none';
    });

    // Nav click handlers
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', async () => {
        const view = item.getAttribute('data-view');
        await this.navigate(view);
        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
      });
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());
    document.getElementById('hdr-logout').addEventListener('click', () => Auth.logout());

    // Mobile menu toggle
    document.getElementById('btn-menu').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Notification bell
    document.getElementById('btn-notif').addEventListener('click', () => this.toggleNotifPanel());

    this.updateNotifBadge();
  },

  async navigate(view) {
    this.currentView = view;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Update page title
    const titles = {
      dashboard:  Auth.isManager() ? 'Manager Dashboard' : 'My Dashboard',
      requests:   Auth.isManager() ? 'Team Leave Requests' : 'My Leave Requests',
      apply:      'Apply for Leave',
      calendar:   'Leave Calendar',
      team:       'Team Overview',
      profile:    'My Profile',
    };
    document.getElementById('page-title').textContent = titles[view] || 'Dashboard';

    // Render view
    const content = document.getElementById('main-content');
    content.classList.add('fade-out');
    
    // Show quick spinner during fetch
    content.innerHTML = '<div class="empty-state" style="padding-top:80px;"><div style="font-size:3rem">⏳</div><p style="margin-top:12px;font-size:1rem;">Loading...</p></div>';

    await this.renderView(view);
    
    content.classList.remove('fade-out');
    content.classList.add('fade-in');
    setTimeout(() => content.classList.remove('fade-in'), 300);
  },

  async renderView(view) {
    const content = document.getElementById('main-content');
    switch (view) {
      case 'dashboard':  content.innerHTML = Auth.isManager() ? await Views.managerDashboard() : await Views.employeeDashboard(); break;
      case 'requests':   content.innerHTML = Auth.isManager() ? await Views.managerRequests()  : await Views.myRequests();        break;
      case 'apply':      content.innerHTML = await Views.applyLeave(); await this.bindApplyForm();                                 break;
      case 'calendar':   content.innerHTML = Views.calendarView(); await this.renderCalendar();                              break;
      case 'team':       content.innerHTML = await Views.teamOverview();                                                     break;
      case 'profile':    content.innerHTML = await Views.profile(); this.bindProfileForm();                                  break;
      default:           content.innerHTML = '<p>View not found.</p>';
    }
    // Bind dynamic buttons after render
    this.bindViewButtons(view);
  },

  bindViewButtons(view) {
    if (view === 'requests' && Auth.isManager()) {
      document.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', () => this.openActionModal(parseInt(btn.dataset.id), 'approved'));
      });
      document.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', () => this.openActionModal(parseInt(btn.dataset.id), 'rejected'));
      });
    }
    if (view === 'dashboard' && Auth.isManager()) {
      document.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', () => this.openActionModal(parseInt(btn.dataset.id), 'approved'));
      });
      document.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', () => this.openActionModal(parseInt(btn.dataset.id), 'rejected'));
      });
    }
    // Quick apply button on employee dashboard
    const qaBtn = document.getElementById('btn-quick-apply');
    if (qaBtn) qaBtn.addEventListener('click', () => this.navigate('apply'));
  },

  async openActionModal(leaveId, action) {
    const leaves = await DB.getLeaves();
    const leave = leaves.find(l => l.id === leaveId);
    if (!leave) return;
    const user = await DB.getUserById(leave.userId);
    const modal = document.getElementById('action-modal');
    const title = document.getElementById('modal-title');
    const body  = document.getElementById('modal-body');
    const confirmBtn = document.getElementById('modal-confirm');

    title.textContent = action === 'approved' ? '✅ Approve Leave Request' : '❌ Reject Leave Request';
    title.className = action === 'approved' ? 'modal-title approve' : 'modal-title reject';

    body.innerHTML = `
      <div class="modal-info">
        <div class="mi-row"><span>Employee</span><strong>${user?.name}</strong></div>
        <div class="mi-row"><span>Leave Type</span><strong class="badge ${leave.type}">${leave.type}</strong></div>
        <div class="mi-row"><span>Duration</span><strong>${leave.startDate} → ${leave.endDate} (${leave.days} day${leave.days>1?'s':''})</strong></div>
        <div class="mi-row"><span>Reason</span><strong>${leave.reason}</strong></div>
      </div>
      <div class="form-group mt-2">
        <label for="modal-comment">Comment (optional)</label>
        <textarea id="modal-comment" class="form-input" rows="3" placeholder="Add a comment…"></textarea>
      </div>
    `;

    confirmBtn.className = `btn ${action === 'approved' ? 'btn-success' : 'btn-danger'}`;
    confirmBtn.textContent = action === 'approved' ? 'Approve' : 'Reject';

    confirmBtn.onclick = async () => {
      const comment = document.getElementById('modal-comment').value;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Processing...';
      const success = await DB.actionLeave(leaveId, action, comment, this.currentUser.id);
      confirmBtn.disabled = false;
      this.closeModal();

      if (success) {
        this.showToast(
          action === 'approved' ? `Leave approved for ${user?.name}!` : `Leave rejected for ${user?.name}.`,
          action === 'approved' ? 'success' : 'error'
        );
        this.navigate(this.currentView);
      } else {
        this.showToast('Failed to process leave action', 'error');
      }
    };

    modal.classList.remove('hidden');
    modal.classList.add('show');
  },

  closeModal() {
    const modal = document.getElementById('action-modal');
    modal.classList.remove('show');
    setTimeout(() => modal.classList.add('hidden'), 300);
  },

  async bindApplyForm() {
    const form = document.getElementById('leave-form');
    if (!form) return;

    const startInput = document.getElementById('lf-start');
    const endInput   = document.getElementById('lf-end');
    const daysSpan   = document.getElementById('lf-days');
    const typeSelect = document.getElementById('lf-type');

    const today = new Date().toISOString().split('T')[0];
    if (startInput) startInput.min = today;
    if (endInput)   endInput.min   = today;

    const calcDays = () => {
      if (startInput.value && endInput.value) {
        const days = DB.calcWorkingDays(startInput.value, endInput.value);
        daysSpan.textContent = `${days} working day${days !== 1 ? 's' : ''}`;
        daysSpan.style.color = days > 0 ? '#6c63ff' : '#ef4444';
        // Check balance
        this.checkBalanceWarning(typeSelect.value, days);
      }
    };

    startInput?.addEventListener('change', () => { if (endInput.value < startInput.value) endInput.value = startInput.value; calcDays(); });
    endInput?.addEventListener('change',   calcDays);
    typeSelect?.addEventListener('change', () => {
      const days = DB.calcWorkingDays(startInput.value || '', endInput.value || '');
      this.checkBalanceWarning(typeSelect.value, days);
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      this.submitLeaveForm();
    });

    document.getElementById('btn-cancel-apply')?.addEventListener('click', () => this.navigate('requests'));
  },

  async checkBalanceWarning(type, days) {
    const warn = document.getElementById('balance-warning');
    if (!warn) return;
    const bal = await DB.getBalanceFor(this.currentUser.id);
    if (!bal || !bal[type]) { warn.classList.add('hidden'); return; }
    const avail = bal[type].total - bal[type].used - (bal[type].pending || 0);
    if (days > avail) {
      warn.textContent = `⚠ Insufficient balance! Available: ${avail} days for ${type} leave.`;
      warn.classList.remove('hidden');
    } else {
      warn.classList.add('hidden');
    }
  },

  async submitLeaveForm() {
    const type      = document.getElementById('lf-type').value;
    const startDate = document.getElementById('lf-start').value;
    const endDate   = document.getElementById('lf-end').value;
    const reason    = document.getElementById('lf-reason').value.trim();
    const errors    = [];

    if (!type)      errors.push('Please select a leave type.');
    if (!startDate) errors.push('Please select a start date.');
    if (!endDate)   errors.push('Please select an end date.');
    if (endDate < startDate) errors.push('End date cannot be before start date.');
    if (!reason)    errors.push('Please provide a reason for your leave.');

    if (errors.length) { this.showFormErrors(errors); return; }

    const days = DB.calcWorkingDays(startDate, endDate);
    if (days === 0) { this.showFormErrors(['Selected range has no working days.']); return; }

    const bal   = await DB.getBalanceFor(this.currentUser.id);
    const avail = bal[type] ? bal[type].total - bal[type].used - (bal[type].pending || 0) : 0;
    if (type !== 'unpaid' && days > avail) {
      this.showFormErrors([`Insufficient ${type} leave balance. Available: ${avail} days.`]);
      return;
    }

    let managerId = 1;
    if (Auth.isEmployee()) {
      managerId = this.currentUser.managerId || 1;
    }

    try {
      const btn = document.querySelector('#leave-form button[type="submit"]');
      if (btn) btn.disabled = true;

      await DB.submitLeave({
        userId: this.currentUser.id,
        type, startDate, endDate, days, reason,
        managerId
      });

      this.showToast('Leave request submitted successfully!', 'success');
      this.navigate('requests');
    } catch (e) {
      this.showFormErrors(['Failed to submit request: ' + e.message]);
      const btn = document.querySelector('#leave-form button[type="submit"]');
      if (btn) btn.disabled = false;
    }
  },

  showFormErrors(errors) {
    const errDiv = document.getElementById('form-errors');
    if (!errDiv) return;
    errDiv.innerHTML = errors.map(e => `<div class="form-error-item">⚠ ${e}</div>`).join('');
    errDiv.classList.remove('hidden');
    errDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  bindProfileForm() {
    const form = document.getElementById('profile-form');
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name  = document.getElementById('pf-name').value.trim();
      const email = document.getElementById('pf-email').value.trim();
      const npwd  = document.getElementById('pf-newpwd').value;

      const updates = { name, email };
      if (npwd) updates.password = npwd;

      try {
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        await DB.updateUser(this.currentUser.id, updates);

        sessionStorage.setItem(Auth.SESSION_KEY, JSON.stringify({ ...Auth.getSession(), name, email }));
        document.getElementById('sb-name').textContent   = name;
        document.getElementById('hdr-name').textContent  = name;
        this.currentUser = Auth.currentUser();
        this.showToast('Profile updated successfully!', 'success');
        
        btn.disabled = false;
        btn.textContent = 'Save Changes';
      } catch (err) {
        this.showToast('Failed to update profile', 'error');
      }
    });
  },

  async renderCalendar() {
    const allLeaves = Auth.isManager()
      ? await DB.getLeaves(true)
      : await DB.getLeavesFor(this.currentUser.id);
    const allUsers  = await DB.getUsers();
    Calendar.render('calendar-container', allLeaves, allUsers);
  },

  async toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      await this.renderNotifPanel();
      await DB.markAllRead(this.currentUser.id);
      setTimeout(() => this.updateNotifBadge(), 300);
    }
  },

  async renderNotifPanel() {
    const panel  = document.getElementById('notif-panel');
    const notifs = await DB.getNotificationsFor(this.currentUser.id);
    notifs.reverse(); // newest first
    if (!notifs.length) {
      panel.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
      return;
    }
    panel.innerHTML = `
      <div class="notif-header">Notifications <span class="notif-count">${notifs.length}</span></div>
      ${notifs.map(n => `
        <div class="notif-item ${n.read ? 'read' : 'unread'} ${n.type}">
          <div class="notif-icon">${n.type === 'success' ? '✅' : n.type === 'error' ? '❌' : 'ℹ️'}</div>
          <div class="notif-text">
            <p>${n.message}</p>
            <small>${Views._fmtDate(n.date)}</small>
          </div>
        </div>
      `).join('')}
    `;
  },

  async updateNotifBadge() {
    const count  = await DB.getUnreadCount(this.currentUser.id);
    const badge  = document.getElementById('notif-badge');
    if (!badge) return;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  },

  startNotifPoll() {
    setInterval(() => this.updateNotifBadge(), 10000);
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('fade-out-toast'); setTimeout(() => toast.remove(), 400); }, 3500);
  }
};

// ============================================================
// VIEWS — Template Rendering Functions
// ============================================================

const Views = {

  // ---- Shared helpers ----
  _badgeType(type) {
    return `<span class="badge ${type}">${type.charAt(0).toUpperCase()+type.slice(1)}</span>`;
  },
  _badgeStatus(status) {
    const icons = { pending: '⏳', approved: '✅', rejected: '❌' };
    return `<span class="status-badge ${status}">${icons[status] || ''} ${status.charAt(0).toUpperCase()+status.slice(1)}</span>`;
  },
  _fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  },
  _balanceCard(type, label, icon, bal) {
    const b     = bal[type] || { total:0, used:0, pending:0 };
    const avail = Math.max(0, b.total - b.used - (b.pending||0));
    const pct   = b.total > 0 ? Math.round((b.used / b.total) * 100) : 0;
    return `
      <div class="balance-card ${type}">
        <div class="bal-icon">${icon}</div>
        <div class="bal-info">
          <div class="bal-label">${label}</div>
          <div class="bal-numbers">
            <span class="bal-avail">${avail}</span>
            <span class="bal-sep">/</span>
            <span class="bal-total">${b.total}</span>
            <span class="bal-unit">days</span>
          </div>
          ${b.pending > 0 ? `<div class="bal-pending">${b.pending} pending</div>` : ''}
          <div class="bal-bar-track"><div class="bal-bar-fill" style="width:${pct}%"></div></div>
        </div>
      </div>
    `;
  },

  // ---- Employee Dashboard ----
  async employeeDashboard() {
    const uid = Auth.currentUserId();
    const bal = await DB.getBalanceFor(uid);
    const leaves = await DB.getLeavesFor(uid);
    const pending  = leaves.filter(l => l.status === 'pending').length;
    const approved = leaves.filter(l => l.status === 'approved').length;
    const rejected = leaves.filter(l => l.status === 'rejected').length;
    const recent   = [...leaves].sort((a,b) => b.id - a.id).slice(0,5);

    return `
      <div class="view-section">
        <!-- Stats Row -->
        <div class="stats-row">
          <div class="stat-card blue">
            <div class="stat-icon">📋</div>
            <div class="stat-info"><span class="stat-val">${leaves.length}</span><span class="stat-label">Total Requests</span></div>
          </div>
          <div class="stat-card amber">
            <div class="stat-icon">⏳</div>
            <div class="stat-info"><span class="stat-val">${pending}</span><span class="stat-label">Pending</span></div>
          </div>
          <div class="stat-card green">
            <div class="stat-icon">✅</div>
            <div class="stat-info"><span class="stat-val">${approved}</span><span class="stat-label">Approved</span></div>
          </div>
          <div class="stat-card red">
            <div class="stat-icon">❌</div>
            <div class="stat-info"><span class="stat-val">${rejected}</span><span class="stat-label">Rejected</span></div>
          </div>
        </div>

        <!-- Leave Balances -->
        <div class="section-header"><h3>Leave Balances</h3></div>
        <div class="balances-grid">
          ${this._balanceCard('vacation','Vacation Leave','🏖️', bal)}
          ${this._balanceCard('sick','Sick Leave','🏥', bal)}
          ${this._balanceCard('personal','Personal Leave','👤', bal)}
          ${this._balanceCard('unpaid','Unpaid Leave','💼', bal)}
        </div>

        <!-- Quick Apply -->
        <div class="quick-apply-banner">
          <div class="qa-text">
            <h3>Need time off?</h3>
            <p>Submit a leave request in seconds.</p>
          </div>
          <button class="btn btn-primary" id="btn-quick-apply">+ Apply for Leave</button>
        </div>

        <!-- Recent Requests -->
        <div class="section-header"><h3>Recent Requests</h3><a onclick="App.navigate('requests')" class="link-all">View All →</a></div>
        ${recent.length ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Applied</th></tr></thead>
              <tbody>
                ${recent.map(l => `
                  <tr>
                    <td>${this._badgeType(l.type)}</td>
                    <td>${this._fmtDate(l.startDate)}</td>
                    <td>${this._fmtDate(l.endDate)}</td>
                    <td><strong>${l.days}</strong></td>
                    <td>${this._badgeStatus(l.status)}</td>
                    <td>${this._fmtDate(l.appliedDate)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state">No leave requests yet. <a onclick="App.navigate(\'apply\')" class="link">Apply now →</a></div>'}
      </div>
    `;
  },

  // ---- Manager Dashboard ----
  async managerDashboard() {
    const uid = Auth.currentUserId();
    const pending  = await DB.getPendingForManager(uid);
    const teamLeaves = await DB.getAllForManager(uid);
    const team     = await DB.getTeamOf(uid);
    const allUsers = await DB.getUsers();
    const approved = teamLeaves.filter(l => l.status === 'approved').length;
    const rejected = teamLeaves.filter(l => l.status === 'rejected').length;

    const pendingRows = pending.map(l => {
      const emp = allUsers.find(u => u.id === l.userId);
      return `
        <tr>
          <td><div class="emp-cell"><span class="avatar-sm">${emp?.avatar||'?'}</span>${emp?.name||'Unknown'}</div></td>
          <td>${this._badgeType(l.type)}</td>
          <td>${this._fmtDate(l.startDate)}</td>
          <td>${this._fmtDate(l.endDate)}</td>
          <td><strong>${l.days}</strong></td>
          <td class="reason-cell" title="${l.reason}">${l.reason.slice(0,30)}${l.reason.length>30?'…':''}</td>
          <td>
            <div class="action-btns">
              <button class="btn btn-sm btn-success btn-approve" data-id="${l.id}">Approve</button>
              <button class="btn btn-sm btn-danger btn-reject" data-id="${l.id}">Reject</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Preload balances and leaves for team
    const allBalances = await DB.getBalances();
    const teamCardsHTML = team.map(emp => {
      const bal = allBalances.find(b => b.userId === emp.id);
      const empLeaves = teamLeaves.filter(l => l.userId === emp.id);
      const onLeave = empLeaves.find(l => {
        const today = new Date().toISOString().split('T')[0];
        return l.status === 'approved' && l.startDate <= today && l.endDate >= today;
      });
      return `
        <div class="team-card-mini">
          <div class="tcm-avatar">${emp.avatar}</div>
          <div class="tcm-info">
            <div class="tcm-name">${emp.name}</div>
            <div class="tcm-dept">${emp.department}</div>
            ${onLeave ? `<div class="tcm-status on-leave">On Leave 🏖️</div>` : `<div class="tcm-status active">Active 🟢</div>`}
          </div>
          <div class="tcm-bal">
            <div class="tcm-bal-item"><span>${bal?.vacation?.total - bal?.vacation?.used - (bal?.vacation?.pending||0) || 0}</span><small>Vacation</small></div>
            <div class="tcm-bal-item"><span>${bal?.sick?.total - bal?.sick?.used - (bal?.sick?.pending||0) || 0}</span><small>Sick</small></div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="view-section">
        <!-- Stats Row -->
        <div class="stats-row">
          <div class="stat-card blue">
            <div class="stat-icon">👥</div>
            <div class="stat-info"><span class="stat-val">${team.length}</span><span class="stat-label">Team Members</span></div>
          </div>
          <div class="stat-card amber">
            <div class="stat-icon">⏳</div>
            <div class="stat-info"><span class="stat-val">${pending.length}</span><span class="stat-label">Pending Approval</span></div>
          </div>
          <div class="stat-card green">
            <div class="stat-icon">✅</div>
            <div class="stat-info"><span class="stat-val">${approved}</span><span class="stat-label">Approved</span></div>
          </div>
          <div class="stat-card red">
            <div class="stat-icon">❌</div>
            <div class="stat-info"><span class="stat-val">${rejected}</span><span class="stat-label">Rejected</span></div>
          </div>
        </div>

        <!-- Pending Approvals -->
        <div class="section-header">
          <h3>⏳ Pending Approvals <span class="badge-count">${pending.length}</span></h3>
        </div>
        ${pending.length ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Actions</th></tr></thead>
              <tbody>${pendingRows}</tbody>
            </table>
          </div>
        ` : '<div class="empty-state success-empty">🎉 No pending requests — all caught up!</div>'}

        <!-- Team Overview mini -->
        <div class="section-header mt-4"><h3>👥 Team Overview</h3><a onclick="App.navigate('team')" class="link-all">View All →</a></div>
        <div class="team-grid-mini">
          ${teamCardsHTML}
        </div>
      </div>
    `;
  },

  // ---- My Requests (Employee) ----
  async myRequests() {
    const rawLeaves = await DB.getLeavesFor(Auth.currentUserId());
    const leaves = [...rawLeaves].sort((a,b) => b.id - a.id);
    return `
      <div class="view-section">
        <div class="section-header">
          <h3>My Leave Requests</h3>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('apply')">+ New Request</button>
        </div>
        ${leaves.length ? `
          <div class="requests-list">
            ${leaves.map(l => `
              <div class="request-card ${l.status}">
                <div class="rc-left">
                  <div class="rc-type">${this._badgeType(l.type)}</div>
                  <div class="rc-dates">${this._fmtDate(l.startDate)} → ${this._fmtDate(l.endDate)}</div>
                  <div class="rc-days">${l.days} working day${l.days>1?'s':''}</div>
                </div>
                <div class="rc-middle">
                  <div class="rc-reason">${l.reason}</div>
                  ${l.managerComment ? `<div class="rc-comment">💬 ${l.managerComment}</div>` : ''}
                </div>
                <div class="rc-right">
                  ${this._badgeStatus(l.status)}
                  <div class="rc-applied">Applied ${this._fmtDate(l.appliedDate)}</div>
                  ${l.actionDate ? `<div class="rc-actioned">Actioned ${this._fmtDate(l.actionDate)}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<div class="empty-state">No leave requests yet. <a onclick="App.navigate(\'apply\')" class="link">Apply now →</a></div>'}
      </div>
    `;
  },

  // ---- Manager All Requests ----
  async managerRequests() {
    const uid = Auth.currentUserId();
    const allLeaves = await DB.getAllForManager(uid);
    allLeaves.sort((a,b) => b.id - a.id);
    const allUsers = await DB.getUsers();

    // Attach row generation fn to window so tab-click can reuse it without complex closures
    window._renderManagerRequestRows = (f) => {
      const filtered = allLeaves.filter(l => f === 'all' || l.status === f);
      if (!filtered.length) return `<tr><td colspan="8" class="empty-state">No requests found.</td></tr>`;
      
      return filtered.map(l => {
        const emp = allUsers.find(u => u.id === l.userId);
        const actions = l.status === 'pending' ? `
          <div class="action-btns">
            <button class="btn btn-sm btn-success btn-approve" data-id="${l.id}">Approve</button>
            <button class="btn btn-sm btn-danger btn-reject" data-id="${l.id}">Reject</button>
          </div>
        ` : Views._badgeStatus(l.status);
        return `
          <tr>
            <td><div class="emp-cell"><span class="avatar-sm">${emp?.avatar||'?'}</span>${emp?.name||'Unknown'}</div></td>
            <td>${Views._badgeType(l.type)}</td>
            <td>${Views._fmtDate(l.startDate)}</td>
            <td>${Views._fmtDate(l.endDate)}</td>
            <td><strong>${l.days}</strong></td>
            <td class="reason-cell" title="${l.reason}">${l.reason.slice(0,35)}${l.reason.length>35?'…':''}</td>
            <td>${l.managerComment || '—'}</td>
            <td>${actions}</td>
          </tr>
        `;
      }).join('');
    };

    const counts = {
      all: allLeaves.length,
      pending: allLeaves.filter(l=>l.status==='pending').length,
      approved: allLeaves.filter(l=>l.status==='approved').length,
      rejected: allLeaves.filter(l=>l.status==='rejected').length,
    };

    return `
      <div class="view-section">
        <div class="filter-tabs" id="filter-tabs">
          <button class="ftab active" data-filter="all">All <span class="ftab-count">${counts.all}</span></button>
          <button class="ftab" data-filter="pending">Pending <span class="ftab-count amber">${counts.pending}</span></button>
          <button class="ftab" data-filter="approved">Approved <span class="ftab-count green">${counts.approved}</span></button>
          <button class="ftab" data-filter="rejected">Rejected <span class="ftab-count red">${counts.rejected}</span></button>
        </div>
        <div class="table-wrapper" id="req-table-wrapper">
          <table class="data-table" id="req-table">
            <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Comment</th><th>Actions</th></tr></thead>
            <tbody id="req-tbody">${window._renderManagerRequestRows('all')}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ---- Apply Leave Form ----
  async applyLeave() {
    const bal = await DB.getBalanceFor(Auth.currentUserId());
    const types = [
      { value:'vacation', label:'🏖️ Vacation Leave' },
      { value:'sick',     label:'🏥 Sick Leave' },
      { value:'personal', label:'👤 Personal Leave' },
      { value:'unpaid',   label:'💼 Unpaid Leave' },
    ];
    return `
      <div class="view-section">
        <div class="form-container">
          <div class="form-header">
            <h2>Apply for Leave</h2>
            <p>Fill in the details below to submit your leave request.</p>
          </div>

          <!-- Balance Summary -->
          <div class="bal-summary-row">
            ${types.map(t => {
              const b = bal[t.value] || {total:0,used:0,pending:0};
              const avail = Math.max(0, b.total - b.used - (b.pending||0));
              return `<div class="bal-chip ${t.value}">
                <span class="bc-icon">${t.label.split(' ')[0]}</span>
                <span class="bc-val">${avail}</span>
                <span class="bc-lbl">${t.value}</span>
              </div>`;
            }).join('')}
          </div>

          <div id="form-errors" class="form-errors hidden"></div>
          <div id="balance-warning" class="balance-warning hidden"></div>

          <form id="leave-form" novalidate>
            <div class="form-row">
              <div class="form-group">
                <label for="lf-type">Leave Type <span class="required">*</span></label>
                <select id="lf-type" class="form-input" required>
                  <option value="">— Select type —</option>
                  ${types.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="lf-days-display">Working Days</label>
                <div class="days-display" id="lf-days">Select dates to calculate</div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="lf-start">Start Date <span class="required">*</span></label>
                <input type="date" id="lf-start" class="form-input" required>
              </div>
              <div class="form-group">
                <label for="lf-end">End Date <span class="required">*</span></label>
                <input type="date" id="lf-end" class="form-input" required>
              </div>
            </div>

            <div class="form-group">
              <label for="lf-reason">Reason for Leave <span class="required">*</span></label>
              <textarea id="lf-reason" class="form-input" rows="4" placeholder="Please provide a brief reason for your leave request…" required></textarea>
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn-ghost" id="btn-cancel-apply">Cancel</button>
              <button type="submit" class="btn btn-primary">Submit Request 🚀</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  // ---- Calendar View ----
  calendarView() {
    return `
      <div class="view-section">
        <div class="calendar-wrapper">
          <div id="calendar-container" class="calendar-container">
             <div class="empty-state">⏳ Loading Calendar...</div>
          </div>
        </div>
      </div>
    `;
  },

  // ---- Team Overview (Manager) ----
  async teamOverview() {
    const uid  = Auth.currentUserId();
    const team = await DB.getTeamOf(uid);
    const today = new Date().toISOString().split('T')[0];

    const allBalances = await DB.getBalances();
    const allLeaves = await DB.getLeaves();

    return `
      <div class="view-section">
        <div class="section-header"><h3>Team Members <span class="badge-count">${team.length}</span></h3></div>
        <div class="team-grid">
          ${team.map(emp => {
            const bal   = allBalances.find(b => b.userId === emp.id);
            const leaves = allLeaves.filter(l => l.userId === emp.id);
            const onLeave = leaves.find(l => l.status==='approved' && l.startDate<=today && l.endDate>=today);
            const pending = leaves.filter(l=>l.status==='pending').length;
            return `
              <div class="team-card">
                <div class="tc-header">
                  <div class="tc-avatar">${emp.avatar}</div>
                  <div class="tc-info">
                    <div class="tc-name">${emp.name}</div>
                    <div class="tc-dept">${emp.department}</div>
                    <div class="tc-email">${emp.email}</div>
                    ${onLeave ? `<div class="tc-onleave">On Leave — ${this._badgeType(onLeave.type)}</div>` : `<span class="tc-active">● Active</span>`}
                  </div>
                </div>
                <div class="tc-balances">
                  <div class="tc-bal-row">
                    <span>🏖️ Vacation</span>
                    <div class="tc-bar-track"><div class="tc-bar-fill vacation" style="width:${Math.round((bal?.vacation?.used||0)/bal?.vacation?.total*100||0)}%"></div></div>
                    <span>${(bal?.vacation?.total||0)-(bal?.vacation?.used||0)-(bal?.vacation?.pending||0)}/${bal?.vacation?.total||0}</span>
                  </div>
                  <div class="tc-bal-row">
                    <span>🏥 Sick</span>
                    <div class="tc-bar-track"><div class="tc-bar-fill sick" style="width:${Math.round((bal?.sick?.used||0)/bal?.sick?.total*100||0)}%"></div></div>
                    <span>${(bal?.sick?.total||0)-(bal?.sick?.used||0)-(bal?.sick?.pending||0)}/${bal?.sick?.total||0}</span>
                  </div>
                  <div class="tc-bal-row">
                    <span>👤 Personal</span>
                    <div class="tc-bar-track"><div class="tc-bar-fill personal" style="width:${Math.round((bal?.personal?.used||0)/bal?.personal?.total*100||0)}%"></div></div>
                    <span>${(bal?.personal?.total||0)-(bal?.personal?.used||0)-(bal?.personal?.pending||0)}/${bal?.personal?.total||0}</span>
                  </div>
                </div>
                <div class="tc-footer">
                  <span>Total Requests: <strong>${leaves.length}</strong></span>
                  ${pending ? `<span class="tc-pending-badge">${pending} pending</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // ---- Profile ----
  async profile() {
    const u = App.currentUser;
    const bal = await DB.getBalanceFor(u.id);
    const leaves = await DB.getLeavesFor(u.id);
    return `
      <div class="view-section">
        <div class="profile-layout">
          <div class="profile-left">
            <div class="profile-avatar-lg">${u.avatar}</div>
            <div class="profile-name">${u.name}</div>
            <div class="profile-role ${u.role}">${u.role}</div>
            <div class="profile-dept">${u.department}</div>
            <div class="profile-meta">
              <div class="pm-row"><span>📧</span>${u.email}</div>
              <div class="pm-row"><span>📅</span>Joined ${Views._fmtDate(u.joinDate)}</div>
              <div class="pm-row"><span>🆔</span>EMP-${String(u.id).padStart(4,'0')}</div>
            </div>
            <div class="profile-stats">
              <div class="ps-item"><strong>${leaves.filter(l=>l.status==='approved').length}</strong><span>Approved</span></div>
              <div class="ps-item"><strong>${leaves.filter(l=>l.status==='pending').length}</strong><span>Pending</span></div>
              <div class="ps-item"><strong>${leaves.filter(l=>l.status==='rejected').length}</strong><span>Rejected</span></div>
            </div>
          </div>
          <div class="profile-right">
            <div class="card">
              <h3 class="card-title">Edit Profile</h3>
              <form id="profile-form">
                <div class="form-group">
                  <label>Full Name</label>
                  <input id="pf-name" class="form-input" value="${u.name}" required>
                </div>
                <div class="form-group">
                  <label>Email Address</label>
                  <input id="pf-email" class="form-input" type="email" value="${u.email}" required>
                </div>
                <div class="form-group">
                  <label>New Password</label>
                  <input id="pf-newpwd" class="form-input" type="password" placeholder="Leave blank to keep current">
                </div>
                <div class="form-actions">
                  <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
              </form>
            </div>
            <div class="card mt-3">
              <h3 class="card-title">Leave Balances</h3>
              <div class="balances-grid">
                ${Views._balanceCard('vacation','Vacation','🏖️',bal)}
                ${Views._balanceCard('sick','Sick Leave','🏥',bal)}
                ${Views._balanceCard('personal','Personal','👤',bal)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

// ---- Filter tab handler (Manager Requests) ----
document.addEventListener('click', e => {
  if (e.target.classList.contains('ftab')) {
    document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    const f   = e.target.dataset.filter;
    const tbody = document.getElementById('req-tbody');
    if (!tbody || !window._renderManagerRequestRows) return;

    tbody.innerHTML = window._renderManagerRequestRows(f);

    // Re-bind approve/reject after filter
    tbody.querySelectorAll('.btn-approve').forEach(btn =>
      btn.addEventListener('click', () => App.openActionModal(parseInt(btn.dataset.id), 'approved')));
    tbody.querySelectorAll('.btn-reject').forEach(btn =>
      btn.addEventListener('click', () => App.openActionModal(parseInt(btn.dataset.id), 'rejected')));
  }
  // Close notif panel on outside click
  const panel = document.getElementById('notif-panel');
  const bell  = document.getElementById('btn-notif');
  if (panel && !panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== bell) {
    panel.classList.add('hidden');
  }
});

// Modal close on backdrop click
document.addEventListener('click', e => {
  const modal = document.getElementById('action-modal');
  if (modal && e.target === modal) App.closeModal();
});

// Init on load
window.addEventListener('DOMContentLoaded', () => App.init());
