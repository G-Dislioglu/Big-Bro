import { useState, useEffect } from 'react'
import './App.css'
import { api, HealthResponse, Task } from './services/api'

function App() {
  const [adminKey, setAdminKey] = useState('')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  // Check health on mount
  useEffect(() => {
    fetchHealth()
  }, [])

  const fetchHealth = async () => {
    try {
      const data = await api.getHealth()
      setHealth(data)
    } catch (err) {
      setError('Failed to fetch health status')
    }
  }

  const checkAuth = async () => {
    if (!adminKey) {
      setError('Please enter admin key')
      return
    }

    setLoading(true)
    setError('')
    api.setAdminKey(adminKey)
    
    try {
      await api.checkAuth()
      setAuthenticated(true)
      setError('')
      fetchTasks()
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
      setAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  const fetchTasks = async () => {
    if (!adminKey) return

    setLoading(true)
    setError('')
    
    try {
      const data = await api.getTasks()
      setTasks(data.tasks)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tasks')
    } finally {
      setLoading(false)
    }
  }

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!adminKey) {
      setError('Please enter admin key')
      return
    }

    if (!newTaskTitle.trim()) {
      setError('Please enter a task title')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      await api.createTask(newTaskTitle)
      setNewTaskTitle('')
      fetchTasks()
    } catch (err: any) {
      setError(err.message || 'Failed to add task')
    } finally {
      setLoading(false)
    }
  }

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    if (!adminKey) return

    setLoading(true)
    setError('')
    
    try {
      await api.updateTask(taskId, { status: newStatus })
      fetchTasks()
    } catch (err: any) {
      setError(err.message || 'Failed to update task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <div className="container">
        <h1>Big-Bro v0.1</h1>
        
        {/* Health Status */}
        <div className="card">
          <h2>System Health</h2>
          {health ? (
            <div className="health-info">
              <div className="health-item">
                <span className="label">Status:</span>
                <span className={`status ${health.ok ? 'ok' : 'error'}`}>
                  {health.ok ? 'OK' : 'ERROR'}
                </span>
              </div>
              <div className="health-item">
                <span className="label">Service:</span>
                <span>{health.service}</span>
              </div>
              <div className="health-item">
                <span className="label">Version:</span>
                <span>{health.version}</span>
              </div>
              <div className="health-item">
                <span className="label">Database:</span>
                <span className={`status ${health.db.configured ? (health.db.ok ? 'ok' : 'warning') : 'warning'}`}>
                  {health.db.configured ? (health.db.ok ? 'Connected' : 'Error') : 'Not Configured'}
                </span>
              </div>
              <div className="health-item">
                <span className="label">Time:</span>
                <span className="timestamp">{new Date(health.time).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <p>Loading...</p>
          )}
        </div>

        {/* Authentication */}
        <div className="card">
          <h2>Authentication</h2>
          <div className="auth-form">
            <input
              type="password"
              placeholder="Enter admin key (x-admin-key)"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="admin-key-input"
            />
            <button onClick={checkAuth} disabled={loading || !adminKey}>
              {authenticated ? 'Authenticated ✓' : 'Check Authentication'}
            </button>
          </div>
          {authenticated && (
            <p className="success">Successfully authenticated!</p>
          )}
        </div>

        {/* Tasks Section */}
        {authenticated && (
          <div className="card">
            <h2>Tasks</h2>
            
            {/* Add Task Form */}
            <form onSubmit={addTask} className="add-task-form">
              <input
                type="text"
                placeholder="Enter new task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                disabled={loading}
              />
              <button type="submit" disabled={loading || !newTaskTitle.trim()}>
                Add Task
              </button>
            </form>

            {/* Error Message */}
            {error && <p className="error">{error}</p>}

            {/* Tasks List */}
            {loading && <p>Loading...</p>}
            
            {!loading && tasks.length === 0 && (
              <p className="no-tasks">No tasks yet. Add your first task above!</p>
            )}
            
            {!loading && tasks.length > 0 && (
              <div className="tasks-list">
                {tasks.map((task) => (
                  <div key={task.id} className="task-item">
                    <div className="task-content">
                      <h3>{task.title}</h3>
                      <p className="task-meta">
                        Created: {new Date(task.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="task-status">
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                        disabled={loading}
                      >
                        <option value="todo">To Do</option>
                        <option value="doing">Doing</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
