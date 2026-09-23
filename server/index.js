import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { starterProblems } from '../shared/neetcode150.js'

const app = express()
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dataFile = path.join(currentDir, 'data.json')

app.use(express.json())

function readData() {
  if (!fs.existsSync(dataFile)) return { problems: starterProblems, activity: {} }
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  const knownTitles = new Set(data.problems.map(problem => problem.title))
  return { problems: [...data.problems, ...starterProblems.filter(problem => !knownTitles.has(problem.title))], activity: data.activity ?? {} }
}
function writeData(data) { fs.writeFileSync(dataFile, JSON.stringify(data, null, 2)) }

app.get('/api/state', (_, res) => res.json(readData()))
app.post('/api/problems', (req, res) => {
  const data = readData()
  const problem = { id: Date.now(), status: 'new', repetitions: 0, nextReview: null, plannedDate: null, ...req.body }
  data.problems.push(problem)
  writeData(data)
  res.status(201).json(problem)
})
app.patch('/api/problems/:id', (req, res) => {
  const data = readData()
  const problem = data.problems.find(item => item.id === Number(req.params.id))
  if (!problem) return res.status(404).json({ error: 'Problem not found' })
  Object.assign(problem, req.body)
  writeData(data)
  res.json(problem)
})
app.post('/api/activity', (req, res) => {
  const data = readData()
  const date = req.body.date
  if (!date) return res.status(400).json({ error: 'Date is required' })
  data.activity[date] = (data.activity[date] ?? 0) + 1
  writeData(data)
  res.json({ date, count: data.activity[date] })
})

app.listen(3001, () => console.log('API running on http://localhost:3001'))
