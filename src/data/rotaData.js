function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function mondayFor(value = new Date()) {
  const date = new Date(value)
  const day = date.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + offset)
  return isoDate(date)
}

export const ROTA_TODAY = isoDate(new Date())
export const ROTA_WEEK_START = mondayFor()

export const rotaEntryTypes = [
  { id: 'Early', label: 'Early', category: 'shift', start: '07:30', end: '15:30', capacityHours: 8 },
  { id: 'Standard', label: 'Standard', category: 'shift', start: '09:00', end: '17:00', capacityHours: 8 },
  { id: 'Late', label: 'Late', category: 'shift', start: '12:00', end: '20:00', capacityHours: 8 },
  { id: 'On Call', label: 'On call', category: 'on-call', start: '17:00', end: '08:00', capacityHours: 0 },
  { id: 'Leave', label: 'Annual leave', category: 'absence', start: '', end: '', capacityHours: 0 },
  { id: 'Sickness', label: 'Sickness', category: 'absence', start: '', end: '', capacityHours: 0 },
  { id: 'Unavailable', label: 'Unavailable', category: 'absence', start: '', end: '', capacityHours: 0 },
]

// Coverage rules are tenant-owned. The UI remains usable without them; it simply
// omits coverage-gap warnings until rules are configured.
export const rotaCoverageRules = {}
