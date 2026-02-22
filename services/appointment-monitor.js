/**
 * Appointment Monitor Service
 *
 * Watches for new or updated service appointments in the dealership
 * DMS (via polling or webhooks) and triggers trade-up opportunity
 * workflows when a qualifying appointment is detected.
 */

/**
 * Poll the DMS for recent service appointments and process any new ones.
 *
 * @param {string} orgId - Organisation / dealer identifier.
 * @returns {Promise<{found: number, queued: number}>} Poll results summary.
 */
export async function pollDmsAppointments(orgId) {
  throw new Error('Not implemented');
}

/**
 * Handle an inbound appointment webhook payload from the DMS.
 *
 * @param {object} payload - Raw webhook payload containing appointment data.
 * @returns {Promise<{appointmentId: string, action: string}>} Processing result.
 */
export async function handleAppointmentWebhook(payload) {
  throw new Error('Not implemented');
}
