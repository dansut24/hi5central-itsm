const API_BASE = window.__HI5_API_BASE__

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  })
  const text = await response.text()
  let payload = {}
  if (text) {
    try { payload = JSON.parse(text) } catch { payload = { error: text } }
  }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload
}

function updatedLabel(value) {
  if (!value) return 'Just now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export function projectForWorkspace(project) {
  return {
    ...project,
    updated: updatedLabel(project.updatedAt),
    activity: (project.activity || []).map((item) => ({
      ...item,
      meta: updatedLabel(item.createdAt || item.meta),
    })),
  }
}

export async function fetchProductionProjects() {
  const payload = await apiJson('/api/v1/projects')
  return (payload.items || []).map(projectForWorkspace)
}

export async function createProductionProject(draft) {
  return projectForWorkspace(await apiJson('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify(draft),
  }))
}

export async function updateProductionProject(projectId, updates) {
  return projectForWorkspace(await apiJson(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }))
}

export async function addProductionProjectTask(projectId, draft) {
  return projectForWorkspace(await apiJson(`/api/v1/projects/${encodeURIComponent(projectId)}/tasks`, {
    method: 'POST',
    body: JSON.stringify(draft),
  }))
}

export async function updateProductionProjectTask(projectId, taskId, updates) {
  return projectForWorkspace(await apiJson(`/api/v1/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }))
}

export async function updateProductionProjectMilestone(projectId, milestoneId, updates) {
  return projectForWorkspace(await apiJson(`/api/v1/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }))
}

export async function updateProductionProjectRisk(projectId, riskId, updates) {
  return projectForWorkspace(await apiJson(`/api/v1/projects/${encodeURIComponent(projectId)}/risks/${encodeURIComponent(riskId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }))
}

export async function addProductionProjectActivity(projectId, text) {
  return projectForWorkspace(await apiJson(`/api/v1/projects/${encodeURIComponent(projectId)}/activity`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }))
}

export async function createProductionProjectMilestone(projectId, draft) {
  return projectForWorkspace(await apiJson(`/api/v1/projects/${encodeURIComponent(projectId)}/milestones`, {
    method: 'POST',
    body: JSON.stringify(draft),
  }))
}

export async function createProductionProjectRisk(projectId, draft) {
  return projectForWorkspace(await apiJson(`/api/v1/projects/${encodeURIComponent(projectId)}/risks`, {
    method: 'POST',
    body: JSON.stringify(draft),
  }))
}