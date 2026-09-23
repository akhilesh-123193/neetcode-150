import { getStore } from '@netlify/blobs'

const starterProblems = [
  ['Two Sum', 'Easy'], ['Valid Anagram', 'Easy'], ['Group Anagrams', 'Medium'], ['Top K Frequent Elements', 'Medium'], ['Product of Array Except Self', 'Medium'], ['Valid Sudoku', 'Medium'], ['Contains Duplicate', 'Easy']
].map(([title, difficulty], index) => ({ id: index + 1, title, category: 'Arrays & Hashing', difficulty, url: '', status: 'new', repetitions: 0, nextReview: null, plannedDate: null }))

async function getData(store) {
  return await store.get('state', { type: 'json' }) ?? { problems: starterProblems, activity: {} }
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
