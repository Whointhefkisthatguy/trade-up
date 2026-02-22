/**
 * Notification Engine Service
 *
 * Central hub for dispatching notifications across channels (email,
 * SMS, in-app). Routes messages based on contact preferences and
 * reacts to internal system events such as task status changes.
 */

/**
 * Send a notification to a contact using the preferred channel.
 *
 * @param {string} contactId - Internal contact identifier.
 * @param {string} template  - Notification template identifier.
 * @param {object} data      - Template merge-field data.
 * @returns {Promise<{channel: string, messageId: string, status: string}>}
 */
export async function notify(contactId, template, data) {
  throw new Error('Not implemented');
}

/**
 * React to a workflow task status change and send relevant
 * notifications to stakeholders.
 *
 * @param {string} taskId    - Internal task identifier.
 * @param {string} oldStatus - Previous task status.
 * @param {string} newStatus - New task status.
 * @returns {Promise<void>}
 */
export async function onTaskStatusChange(taskId, oldStatus, newStatus) {
  throw new Error('Not implemented');
}
