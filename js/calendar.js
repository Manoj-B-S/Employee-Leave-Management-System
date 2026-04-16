// ============================================================
// CALENDAR.JS — Full Calendar Component
// ============================================================

const Calendar = {
  currentDate: new Date(),
  selectedDate: null,

  render(containerId, leaves, users) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const year  = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dayNames   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0,0,0,0);

    // Build leave date map
    const leaveMap = {};
    (leaves || []).filter(l => l.status === 'approved' || l.status === 'pending').forEach(l => {
      const cur = new Date(l.startDate);
      const end = new Date(l.endDate);
      while (cur <= end) {
        const key = cur.toISOString().split('T')[0];
        if (!leaveMap[key]) leaveMap[key] = [];
        const user = (users || []).find(u => u.id === l.userId);
        leaveMap[key].push({ name: user?.name || 'Unknown', type: l.type, status: l.status, avatar: user?.avatar || '??' });
        cur.setDate(cur.getDate() + 1);
      }
    });

    let html = `
      <div class="cal-header">
        <button class="cal-nav" id="cal-prev">&#8249;</button>
        <h2 class="cal-title">${monthNames[month]} ${year}</h2>
        <button class="cal-nav" id="cal-next">&#8250;</button>
      </div>
      <div class="cal-grid">
        ${dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
    `;

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) html += `<div class="cal-cell empty"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const cellDate = new Date(year, month, day);
      cellDate.setHours(0,0,0,0);
      const isToday   = cellDate.getTime() === today.getTime();
      const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
      const onLeave   = leaveMap[dateStr] || [];
      const dotColors = [...new Set(onLeave.map(e => e.type))];

      let classes = 'cal-cell';
      if (isToday)   classes += ' today';
      if (isWeekend) classes += ' weekend';
      if (onLeave.length) classes += ' has-leave';

      const dotsHtml = dotColors.slice(0,3).map(t => `<span class="cal-dot ${t}"></span>`).join('');
      const avatarsHtml = onLeave.slice(0,3).map(e =>
        `<span class="cal-avatar ${e.status}" title="${e.name} — ${e.type}">${e.avatar}</span>`
      ).join('') + (onLeave.length > 3 ? `<span class="cal-avatar-more">+${onLeave.length-3}</span>` : '');

      html += `
        <div class="${classes}" data-date="${dateStr}" onclick="Calendar.selectDate('${dateStr}')">
          <span class="cal-num">${day}</span>
          ${onLeave.length ? `<div class="cal-avatars">${avatarsHtml}</div>` : ''}
          <div class="cal-dots">${dotsHtml}</div>
        </div>
      `;
    }

    html += `</div>`;

    // Legend
    html += `
      <div class="cal-legend">
        <span class="legend-item"><span class="cal-dot vacation"></span> Vacation</span>
        <span class="legend-item"><span class="cal-dot sick"></span> Sick Leave</span>
        <span class="legend-item"><span class="cal-dot personal"></span> Personal</span>
        <span class="legend-item"><span class="cal-dot unpaid"></span> Unpaid</span>
        <span class="legend-item today-legend">Today</span>
      </div>
    `;

    // Tooltip panel
    html += `<div id="cal-tooltip" class="cal-tooltip hidden"></div>`;

    container.innerHTML = html;

    // Nav Buttons
    document.getElementById('cal-prev').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render(containerId, leaves, users);
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render(containerId, leaves, users);
    });

    // Store leaveMap for tooltip
    this._leaveMap = leaveMap;
  },

  selectDate(dateStr) {
    this._leaveMap = this._leaveMap || {};
    const entries = this._leaveMap[dateStr] || [];
    const tooltip = document.getElementById('cal-tooltip');
    if (!tooltip) return;

    // Deselect
    document.querySelectorAll('.cal-cell.selected').forEach(c => c.classList.remove('selected'));
    const cell = document.querySelector(`.cal-cell[data-date="${dateStr}"]`);
    if (cell) cell.classList.add('selected');

    if (!entries.length) {
      tooltip.classList.add('hidden');
      return;
    }

    const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    tooltip.innerHTML = `
      <div class="tooltip-header"><strong>${fmt(dateStr)}</strong> — ${entries.length} employee${entries.length > 1 ? 's' : ''} on leave</div>
      <div class="tooltip-list">
        ${entries.map(e => `
          <div class="tooltip-entry">
            <span class="t-avatar">${e.avatar}</span>
            <span class="t-name">${e.name}</span>
            <span class="t-badge ${e.type}">${e.type}</span>
            <span class="t-status ${e.status}">${e.status}</span>
          </div>
        `).join('')}
      </div>
    `;
    tooltip.classList.remove('hidden');
  }
};
