// ============================================================
// AUTH.JS — Authentication & Session Management
// ============================================================

const Auth = {
  SESSION_KEY: 'lms_session',

  async login(email, password) {
    const user = await DB.login(email, password);
    if (user) {
      // Store full user info loosely in session to allow synchronous retrieval in UI
      const session = { 
        userId: user.id, 
        role: user.role, 
        name: user.name, 
        avatar: user.avatar, 
        email: user.email,
        department: user.department,
        managerId: user.managerId,
        joinDate: user.joinDate,
        loginTime: Date.now() 
      };
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      return user;
    }
    return null;
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.href = 'index.html';
  },

  getSession() {
    try { return JSON.parse(sessionStorage.getItem(this.SESSION_KEY)); } catch { return null; }
  },

  isLoggedIn()   { return !!this.getSession(); },
  isManager()    { return this.getSession()?.role === 'manager'; },
  isEmployee()   { return this.getSession()?.role === 'employee'; },
  currentUserId(){ return this.getSession()?.userId; },
  currentUser()  { 
    const s = this.getSession();
    if (!s) return null;
    return { id: s.userId, ...s };
  },

  requireAuth() {
    if (!this.isLoggedIn()) { window.location.href = 'index.html'; return false; }
    return true;
  }
};
