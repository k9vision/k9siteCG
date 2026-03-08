// iCal feed generator for K9 Vision calendar sync (RFC 5545)

const DAY_NAMES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// Format date (YYYY-MM-DD) + time (HH:MM) into iCal datetime: YYYYMMDDTHHmmss
function formatIcalDateTime(date, time) {
  return date.replace(/-/g, '') + 'T' + time.replace(/:/g, '') + '00';
}

// Format a Date object to YYYYMMDD
function formatDateOnly(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Format a Date object to YYYY-MM-DD
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Current UTC timestamp in iCal format
function nowStamp() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const sec = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${sec}Z`;
}

// Build a single VEVENT block
function vevent({ uid, dtstart, dtend, summary, description, allDay }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStamp()}`,
  ];
  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
  } else {
    lines.push(`DTSTART;TZID=America/Chicago:${dtstart}`);
    lines.push(`DTEND;TZID=America/Chicago:${dtend}`);
  }
  lines.push(`SUMMARY:${summary}`);
  if (description) {
    lines.push(`DESCRIPTION:${description}`);
  }
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export async function generateIcalFeed(db, userId, role) {
  const events = [];
  const stamp = nowStamp();

  // --- Appointments ---
  let appointments;
  if (role === 'admin') {
    appointments = await db.prepare(`
      SELECT a.*, c.client_name, c.dog_name
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.status IN ('pending','confirmed')
    `).all();
  } else {
    const client = await db.prepare(
      'SELECT id FROM clients WHERE user_id = ?'
    ).bind(userId).first();
    if (client) {
      appointments = await db.prepare(`
        SELECT a.*, c.client_name, c.dog_name
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.status IN ('pending','confirmed') AND a.client_id = ?
      `).bind(client.id).all();
    } else {
      appointments = { results: [] };
    }
  }

  for (const appt of (appointments.results || [])) {
    const summary = `K9 Vision: ${appt.service_name || 'Training'} - ${appt.client_name || 'Client'}`;
    events.push(vevent({
      uid: `appointment-${appt.id}@k9visiontx.com`,
      dtstart: formatIcalDateTime(appt.appointment_date, appt.start_time),
      dtend: formatIcalDateTime(appt.appointment_date, appt.end_time),
      summary,
      description: appt.notes || undefined,
    }));
  }

  // --- Admin-only: Availability slots + Blocked dates ---
  if (role === 'admin') {
    // Availability slots
    const slots = await db.prepare(
      'SELECT * FROM availability_slots WHERE is_active = 1'
    ).all();

    const today = new Date();
    for (const slot of (slots.results || [])) {
      if (slot.specific_date) {
        // One-time slot on a specific date
        events.push(vevent({
          uid: `availability-${slot.id}-${slot.specific_date}@k9visiontx.com`,
          dtstart: formatIcalDateTime(slot.specific_date, slot.start_time),
          dtend: formatIcalDateTime(slot.specific_date, slot.end_time),
          summary: `Available: ${slot.start_time}-${slot.end_time}`,
        }));
      } else {
        // Recurring slot: generate events for next 4 weeks
        for (let w = 0; w < 4; w++) {
          for (let d = 0; d < 7; d++) {
            const candidate = new Date(today);
            candidate.setDate(today.getDate() + (w * 7) + d);
            if (candidate.getDay() === slot.day_of_week) {
              const dateStr = toISODate(candidate);
              events.push(vevent({
                uid: `availability-${slot.id}-${dateStr}@k9visiontx.com`,
                dtstart: formatIcalDateTime(dateStr, slot.start_time),
                dtend: formatIcalDateTime(dateStr, slot.end_time),
                summary: `Available: ${slot.start_time}-${slot.end_time}`,
              }));
            }
          }
        }
      }
    }

    // Blocked dates
    const blocked = await db.prepare('SELECT * FROM blocked_dates').all();
    for (const b of (blocked.results || [])) {
      if (b.all_day) {
        // All-day blocked event (DTEND is next day per RFC 5545)
        const startDate = new Date(b.blocked_date + 'T00:00:00');
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        events.push(vevent({
          uid: `blocked-${b.id}@k9visiontx.com`,
          dtstart: formatDateOnly(startDate),
          dtend: formatDateOnly(endDate),
          summary: `BLOCKED: ${b.reason || 'Unavailable'}`,
          allDay: true,
        }));
      } else {
        events.push(vevent({
          uid: `blocked-${b.id}@k9visiontx.com`,
          dtstart: formatIcalDateTime(b.blocked_date, b.start_time),
          dtend: formatIcalDateTime(b.blocked_date, b.end_time),
          summary: `BLOCKED: ${b.reason || 'Unavailable'}`,
        }));
      }
    }
  }

  // --- Build VCALENDAR ---
  const calName = role === 'admin'
    ? 'K9 Vision Training'
    : 'K9 Vision - My Appointments';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//K9 Vision Dog Training//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    'X-WR-TIMEZONE:America/Chicago',
    ...events,
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}
