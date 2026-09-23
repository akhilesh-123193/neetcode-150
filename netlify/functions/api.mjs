import { getStore } from '@netlify/blobs'
import { starterProblems } from '../../shared/neetcode150.js'

async function getData(store) {
  const data = await store.get('state', { type: 'json' })
  if (!data) return { problems: starterProblems, activity: {} }
  const knownTitles = new Set(data.problems.map(problem => problem.title))
  return { problems: [...data.problems, ...starterProblems.filter(problem => !knownTitles.has(problem.title))], activity: data.activity ?? {} }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export default async request => {
  const url = new URL(request.url)
  const route = url.pathname.replace(/^\/.netlify\/functions\/api/, '').replace(/^\/api/, '') || '/'
  const store = getStore('recall-data', { consistency: 'strong' })

  if (request.method === 'GET' && route === '/state') return json(await getData(store))

  const data = await getData(store)
  if (request.method === 'POST' && route === '/problems') {
    const problem = { id: Date.now(), status: 'new', repetitions: 0, nextReview: null, plannedDate: null, ...await request.json() }
    data.problems.push(problem)
    await store.setJSON('state', data)
    return json(problem, 201)
  }

  if (request.method === 'POST' && route === '/activity') {
    const { date } = await request.json()
    if (!date) return json({ error: 'Date is required' }, 400)
    data.activity[date] = (data.activity[date] ?? 0) + 1
    await store.setJSON('state', data)
    return json({ date, count: data.activity[date] })
  }

  const match = route.match(/^\/problems\/(\d+)$/)
  if (request.method === 'PATCH' && match) {
    const problem = data.problems.find(item => item.id === Number(match[1]))
    if (!problem) return json({ error: 'Problem not found' }, 404)
    Object.assign(problem, await request.json())
    await store.setJSON('state', data)
    return json(problem)
  }

  return json({ error: 'Not found' }, 404)
}
