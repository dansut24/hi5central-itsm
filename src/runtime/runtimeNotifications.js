export const notificationSourceLabels = {
  itsm: 'ITSM', livechat: 'Live Chat', projects: 'Projects', calendar: 'Calendar', rota: 'Rota',
}

export function createNotification(notification) {
  return {
    id: `NOT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source: 'itsm', tone: 'info', read: false, createdAt: new Date().toISOString(), ...notification,
  }
}
