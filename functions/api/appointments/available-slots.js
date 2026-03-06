import { requireAuth } from '../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(context.request.url);
    const date = url.searchParams.get('date');

    if (!date) {
      return new Response(JSON.stringify({ error: 'date parameter is required (YYYY-MM-DD)' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();

    // Get active availability slots for this day
    const { results: slots } = await context.env.DB.prepare(
      'SELECT * FROM availability_slots WHERE day_of_week = ? AND is_active = 1'
    ).bind(dayOfWeek).all();

    if (slots.length === 0) {
      return new Response(JSON.stringify({ success: true, available_slots: [], message: 'No availability on this day' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if date is fully blocked
    const blocked = await context.env.DB.prepare(
      'SELECT * FROM blocked_dates WHERE blocked_date = ?'
    ).bind(date).first();

    if (blocked && blocked.all_day) {
      return new Response(JSON.stringify({ success: true, available_slots: [], message: 'This date is blocked' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get existing bookings for this date
    const { results: bookings } = await context.env.DB.prepare(
      "SELECT start_time, end_time FROM appointments WHERE appointment_date = ? AND status IN ('pending', 'confirmed')"
    ).bind(date).all();

    const bookedTimes = new Set(bookings.map(b => b.start_time));

    // Generate time intervals from availability slots
    const availableSlots = [];

    for (const slot of slots) {
      const duration = slot.slot_duration_minutes;
      let [startH, startM] = slot.start_time.split(':').map(Number);
      const [endH, endM] = slot.end_time.split(':').map(Number);
      const endMinutes = endH * 60 + endM;

      let currentMinutes = startH * 60 + startM;

      while (currentMinutes + duration <= endMinutes) {
        const slotStart = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
        const slotEndMin = currentMinutes + duration;
        const slotEnd = `${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')}`;

        let isAvailable = !bookedTimes.has(slotStart);

        // Check partial blocked times
        if (isAvailable && blocked && !blocked.all_day && blocked.start_time && blocked.end_time) {
          if (slotStart < blocked.end_time && slotEnd > blocked.start_time) {
            isAvailable = false;
          }
        }

        if (isAvailable) {
          availableSlots.push({ start_time: slotStart, end_time: slotEnd, duration_minutes: duration });
        }

        currentMinutes += duration;
      }
    }

    return new Response(JSON.stringify({ success: true, available_slots: availableSlots }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Available slots error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load available slots' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
