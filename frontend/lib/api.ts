import axios from 'axios'

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 60000,
})

// Auto-attach token
API.interceptors.request.use((cfg) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) cfg.headers.Authorization = `Bearer ${token}`
  }
  return cfg
})

// Auto-refresh on 401
API.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/refresh`,
            { refresh_token: refresh }
          )
          localStorage.setItem('access_token', data.data.access_token)
          err.config.headers.Authorization = `Bearer ${data.data.access_token}`
          return API(err.config)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

// ─── Auth ───────────────────────────────────────────────
export const authApi = {
  register: (body: any) => API.post('/auth/register', body).then(r => r.data),
  login:    (body: any) => API.post('/auth/login', body).then(r => r.data),
  me:       ()          => API.get('/auth/me').then(r => r.data),
  refresh:  (token: string) => API.post('/auth/refresh', { refresh_token: token }).then(r => r.data),
}

// ─── Recipes ─────────────────────────────────────────────
export const recipesApi = {
  generate: (body: any) => API.post('/recipes/generate', body).then(r => r.data),
  list:     (userId: string, skip = 0, limit = 12) =>
    API.get(`/recipes/user/${userId}?skip=${skip}&limit=${limit}`).then(r => r.data),
  toggleSave: (id: string) => API.put(`/recipes/${id}/save`).then(r => r.data),
  delete:     (id: string) => API.delete(`/recipes/${id}`).then(r => r.data),
}

// ─── Pantry ──────────────────────────────────────────────
export const pantryApi = {
  list:     (userId: string) => API.get(`/pantry/${userId}`).then(r => r.data),
  expiring: (days = 5)       => API.get(`/pantry/expiring?days=${days}`).then(r => r.data),
  add:      (body: any)      => API.post('/pantry/item', body).then(r => r.data),
  update:   (id: string, body: any) => API.put(`/pantry/item/${id}`, body).then(r => r.data),
  delete:   (id: string)     => API.delete(`/pantry/item/${id}`).then(r => r.data),
  optimize: ()               => API.post('/pantry/optimize').then(r => r.data),
}

// ─── Health ──────────────────────────────────────────────
export const healthApi = {
  stats:          (userId: string) => API.get(`/health/stats/${userId}`).then(r => r.data),
  updateProfile:  (userId: string, body: any) => API.put(`/health/profile/${userId}`, body).then(r => r.data),
  history:        (userId: string, days = 30) => API.get(`/health/history/${userId}?days=${days}`).then(r => r.data),
}

// ─── Meal Planner ────────────────────────────────────────
export const mealPlanApi = {
  getWeek:   (userId: string, week?: string) =>
    API.get(`/meal-planner/${userId}${week ? `?week=${week}` : ''}`).then(r => r.data),
  setSlot:   (body: any) => API.post('/meal-planner/slot', body).then(r => r.data),
  clearSlot: (date: string, mealType: string) => {
    const today = new Date()
    const week = `${today.getFullYear()}-W${String(getISOWeek(today)).padStart(2, '0')}`
    return API.delete(`/meal-planner/slot/${week}/${date}/${mealType}`).then(r => r.data)
  },
}

function getISOWeek(d: Date): number {
  const date = new Date(d.getTime())
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
  const week1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

export default API
