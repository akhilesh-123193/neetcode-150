import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dataFile = path.join(currentDir, 'data.json')

app.use(express.json())

const starterProblems = [
  ['Two Sum', 'Easy'], ['Valid Anagram', 'Easy'], ['Group Anagrams', 'Medium'], ['Top K Frequent Elements', 'Medium'], ['Product of Array Except Self', 'Medium'], ['Valid Sudoku', 'Medium'], ['Contains Duplicate', 'Easy']
].map(([title, difficulty], index) => ({ id: index + 1, title, category: 'Arrays & Hashing', difficulty, url: '', status: 'new', repetitions: 0, nextReview: null, plannedDate: null }))

function readData() {
  if (!fs.existsSync(dataFile)) return { problems: starterProblems, activity: {} }
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'))
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

app.listen(3001, () => console.log('API running on http://localhost:3001'))
