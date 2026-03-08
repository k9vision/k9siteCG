// Google Calendar API helper utilities

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const TIMEZONE = 'America/Chicago';

export async function getValidAccessToken(db, userId, env) {
  const row = await db.prepare(
    'SELECT * FROM google_calendar_tokens WHERE user_id = ?'
  ).bind(userId).first();

  if (!row) return null;

  // If token is still valid (with 60s buffer), return it
  if (new Date(row.token_expires_at) > new Date(Date.now() + 60000)) {
    return row.access_token;
  }

  // Refresh the token
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: row.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      console.error('Token refresh failed:', await res.text());
      return null;
    }

    const data = await res.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await db.prepare(
      'UPDATE google_calendar_tokens SET access_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
    ).bind(data.access_token, expiresAt, userId).run();

    return data.access_token;
  } catch (err) {
    console.error('Token refresh error:', err);
    return null;
  }
}

export async function createCalendarEvent(accessToken, calendarId, eventData) {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create event failed (${res.status}): ${text}`);
  }

  return await res.json();
}

export async function updateCalendarEvent(accessToken, calendarId, googleEventId, eventData) {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update event failed (${res.status}): ${text}`);
  }

  return await res.json();
}

export async function deleteCalendarEvent(accessToken, calendarId, googleEventId) {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    throw new Error(`Delete event failed (${res.status}): ${text}`);
  }
}

export async function syncAppointmentToGoogle(db, env, appointment, clientId) {
  const clientRow = await db.prepare('SELECT client_name FROM clients WHERE id = ?').bind(clientId).first();
  const clientName = clientRow?.client_name || 'Client';

  const eventData = buildAppointmentEvent(appointment, clientName);

  // Sync to admin's calendar
  const adminUser = await db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").first();
  if (adminUser) {
    await syncEventForUser(db, env, adminUser.id, 'appointment', appointment.id, eventData);
  }

  // Sync to client's calendar (if they have Google connected)
  const clientUser = await db.prepare('SELECT user_id FROM clients WHERE id = ?').bind(clientId).first();
  if (clientUser?.user_id) {
    await syncEventForUser(db, env, clientUser.user_id, 'appointment', appointment.id, eventData);
  }
}

export async function syncAvailabilityToGoogle(db, env, slot) {
  const adminUser = await db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").first();
  if (!adminUser) return;

  if (slot.specific_date) {
    // Single date availability
    const eventData = {
      summary: `K9 Vision: Available`,
      description: `Availability slot: ${slot.start_time} - ${slot.end_time}`,
      start: { dateTime: toRfc3339(slot.specific_date, slot.start_time), timeZone: TIMEZONE },
      end: { dateTime: toRfc3339(slot.specific_date, slot.end_time), timeZone: TIMEZONE },
      transparency: 'transparent',
    };
    await syncEventForUser(db, env, adminUser.id, 'availability', slot.id, eventData);
  } else {
    // Recurring: create events for the next 4 weeks
    const today = new Date();
    for (let week = 0; week < 4; week++) {
      const date = getNextDayOfWeek(today, slot.day_of_week, week);
      const dateStr = date.toISOString().split('T')[0];
      const eventData = {
        summary: `K9 Vision: Available`,
        description: `Recurring availability: ${slot.start_time} - ${slot.end_time}`,
        start: { dateTime: toRfc3339(dateStr, slot.start_time), timeZone: TIMEZONE },
        end: { dateTime: toRfc3339(dateStr, slot.end_time), timeZone: TIMEZONE },
        transparency: 'transparent',
      };
      await syncEventForUser(db, env, adminUser.id, 'availability', slot.id, eventData);
    }
  }
}

export async function syncBlockedDateToGoogle(db, env, blockedDate) {
  const adminUser = await db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").first();
  if (!adminUser) return;

  let eventData;
  if (blockedDate.all_day || (!blockedDate.start_time && !blockedDate.end_time)) {
    eventData = {
      summary: `Blocked - ${blockedDate.reason || 'Unavailable'}`,
      start: { date: blockedDate.blocked_date },
      end: { date: blockedDate.blocked_date },
      transparency: 'opaque',
    };
  } else {
    eventData = {
      summary: `Blocked - ${blockedDate.reason || 'Unavailable'}`,
      start: { dateTime: toRfc3339(blockedDate.blocked_date, blockedDate.start_time), timeZone: TIMEZONE },
      end: { dateTime: toRfc3339(blockedDate.blocked_date, blockedDate.end_time), timeZone: TIMEZONE },
      transparency: 'opaque',
    };
  }

  await syncEventForUser(db, env, adminUser.id, 'blocked_date', blockedDate.id, eventData);
}

export async function removeSyncedEvents(db, env, entityType, entityId) {
  const { results: syncRows } = await db.prepare(
    'SELECT * FROM calendar_event_sync WHERE entity_type = ? AND entity_id = ?'
  ).bind(entityType, entityId).all();

  for (const row of syncRows) {
    try {
      const accessToken = await getValidAccessToken(db, row.user_id, env);
      if (accessToken) {
        await deleteCalendarEvent(accessToken, row.calendar_id, row.google_event_id);
      }
    } catch (err) {
      console.error(`Failed to delete Google event ${row.google_event_id}:`, err);
    }
  }

  if (syncRows.length > 0) {
    await db.prepare(
      'DELETE FROM calendar_event_sync WHERE entity_type = ? AND entity_id = ?'
    ).bind(entityType, entityId).run();
  }
}

// --- Internal helpers ---

async function syncEventForUser(db, env, userId, entityType, entityId, eventData) {
  const accessToken = await getValidAccessToken(db, userId, env);
  if (!accessToken) return;

  const tokenRow = await db.prepare(
    'SELECT calendar_id FROM google_calendar_tokens WHERE user_id = ?'
  ).bind(userId).first();
  const calendarId = tokenRow?.calendar_id || 'primary';

  try {
    const created = await createCalendarEvent(accessToken, calendarId, eventData);
    await db.prepare(
      'INSERT INTO calendar_event_sync (user_id, entity_type, entity_id, google_event_id, calendar_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, entityType, entityId, created.id, calendarId).run();
  } catch (err) {
    console.error(`Sync event for user ${userId} failed:`, err);
  }
}

function buildAppointmentEvent(appointment, clientName) {
  return {
    summary: `K9 Vision: ${appointment.service_name || 'Training'} - ${clientName}`,
    description: appointment.notes || '',
    start: {
      dateTime: toRfc3339(appointment.appointment_date, appointment.start_time),
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: toRfc3339(appointment.appointment_date, appointment.end_time),
      timeZone: TIMEZONE,
    },
  };
}

function toRfc3339(dateStr, timeStr) {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:MM" or "HH:MM:SS"
  const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return `${dateStr}T${time}`;
}

function getNextDayOfWeek(fromDate, dayOfWeek, weekOffset) {
  const date = new Date(fromDate);
  const currentDay = date.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil < 0) daysUntil += 7;
  date.setDate(date.getDate() + daysUntil + (weekOffset * 7));
  return date;
}
