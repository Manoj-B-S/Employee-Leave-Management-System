// ============================================================
// DB.JS — API Database Layer (Connects to Node.js Backend)
// ============================================================

const API_BASE = 'http://localhost:3000/api';

const DB = {
  // Caches to avoid over-fetching
  _usersCache: null,
  _balancesCache: null,
  _leavesCache: null,
  _notifsCache: null,

  async fetchCache(url, cacheKey, force = false) {
    if (!this[cacheKey] || force) {
      const res = await fetch(`${API_BASE}${url}`);
      this[cacheKey] = await res.json();
    }
    return this[cacheKey];
  },

  async clearCaches() {
    this._usersCache = null;
    this._balancesCache = null;
    this._leavesCache = null;
    this._notifsCache = null;
  },

  async init() {
    // Optional preload
    await this.fetchCache('/users', '_usersCache', true);
  },

  // ---------- USERS ----------
  async getUsers(force = false)      { return await this.fetchCache('/users', '_usersCache', force); },
  async getUserById(id)              { const users = await this.getUsers(); return users.find(u => u.id === id); },
  async getUserByEmail(email)        { const users = await this.getUsers(); return users.find(u => u.email === email); },
  async getEmployees()               { const users = await this.getUsers(); return users.filter(u => u.role === 'employee'); },
  async getManagers()                { const users = await this.getUsers(); return users.filter(u => u.role === 'manager'); },
  async getTeamOf(managerId)         { const users = await this.getUsers(); return users.filter(u => u.managerId === managerId); },

  async updateUser(id, data) {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) await this.getUsers(true); // force refresh cache
  },

  // ---------- AUTH ----------
  async login(email, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password })
    });
    const data = await res.json();
    if (data.success) {
      return data.user;
    }
    return null;
  },

  // ---------- BALANCES ----------
  async getBalances(force = false)     { return await this.fetchCache('/balances', '_balancesCache', force); },
  async getBalanceFor(userId)          { const bals = await this.getBalances(); return bals.find(b => b.userId === userId); },

  // ---------- LEAVES ----------
  async getLeaves(force = false)       { return await this.fetchCache('/leaves', '_leavesCache', force); },
  async getLeavesFor(userId)           { const leaves = await this.getLeaves(); return leaves.filter(l => l.userId === userId); },
  async getPendingForManager(managerId){ const leaves = await this.getLeaves(); return leaves.filter(l => l.managerId === managerId && l.status === 'pending'); },
  async getAllForManager(managerId)    { 
    const users = await this.getTeamOf(managerId);
    const teamIds = users.map(u => u.id);
    const leaves = await this.getLeaves();
    return leaves.filter(l => teamIds.includes(l.userId));
  },

  async submitLeave(data) {
    const res = await fetch(`${API_BASE}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      this._leavesCache = null; // bust cache
      this._balancesCache = null;
      return true;
    }
    throw new Error(result.error);
  },

  async actionLeave(leaveId, action, comment, managerId) {
    const res = await fetch(`${API_BASE}/leaves/${leaveId}/action`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, managerComment: comment, managerId })
    });
    const result = await res.json();
    if (result.success) {
      this._leavesCache = null;
      this._balancesCache = null;
      return true;
    }
    return false;
  },

  // ---------- NOTIFICATIONS ----------
  async getNotifications(force = false) { return await this.fetchCache('/notifications', '_notifsCache', force); },
  async getNotificationsFor(userId)     { const notifs = await this.getNotifications(); return notifs.filter(n => n.userId === userId); },
  async getUnreadCount(userId)          { const notifs = await this.getNotificationsFor(userId); return notifs.filter(n => !n.read).length; },

  async markAllRead(userId) {
    await fetch(`${API_BASE}/notifications/read/${userId}`, { method: 'PUT' });
    this._notifsCache = null;
  },

  // ---------- HELPERS ----------
  calcWorkingDays(start, end) {
    let count = 0;
    const cur = new Date(start);
    const last = new Date(end);
    while (cur <= last) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }
};
