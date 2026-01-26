import { useState, useEffect } from 'react'
import './App.css'
import './styles/ethereal-glass.css'
import { api, HealthResponse, Task } from './services/api'
import { IdeaLab } from './components/IdeaLab'
import { StrategyLab } from './components/StrategyLab'
import { AmbientBackground, LoadingPulse } from './components/EtherealComponents'

function App() {
  const [adminKey, setAdminKey] = useState(() => {
    try {
      return localStorage.getItem('adminKey') || ''
    } catch {
      return ''
    }
  })
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  const [currentView, setCurrentView] = useState<'tasks' | 'cards' | 'ideas'>('ideas')

  // Check health on mount
  useEffect(() => {
    fetchHealth()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('adminKey', adminKey)
    } catch {
      // ignore
    }
  }, [adminKey])

  useEffect(() => {
    api.setAdminKey(adminKey)
  }, [adminKey])

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
    <>
      <AmbientBackground />
      <div className="min-h-screen bg-slate-900 relative z-10">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-4">Big-Bro</h1>
            <div className="flex gap-4 flex-wrap">
              <button 
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currentView === 'tasks' 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
                onClick={() => setCurrentView('tasks')}
              >
                Tasks
              </button>
              <button 
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currentView === 'cards' 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
                onClick={() => setCurrentView('cards')}
              >
                Strategy Lab
              </button>
              <button 
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currentView === 'ideas' 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
                onClick={() => setCurrentView('ideas')}
                disabled={!authenticated}
              >
                Idea Lab
              </button>
            </div>
          </header>

          {/* Health Status */}
          {health && (
            <div className="mb-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-2">System Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Database:</span>
                  <span className={`ml-2 font-medium ${health.db ? 'text-green-400' : 'text-red-400'}`}>
                    {health.db ? 'Connected' : 'Error'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Version:</span>
                  <span className="ml-2 text-gray-300">{health.version}</span>
                </div>
                <div>
                  <span className="text-gray-400">Uptime:</span>
                  <span className="ml-2 text-gray-300">{health.time}s</span>
                </div>
              </div>
            </div>
          )}

          {/* Authentication */}
          {!authenticated ? (
            <div className="glass-card glass-base max-w-md mx-auto">
              <h2 className="text-xl font-semibold glass-text-primary mb-4">Authentication</h2>
              <div className="space-y-4">
                <div>
                  <label className="block glass-text-secondary text-sm font-medium mb-2">
                    Admin Key
                  </label>
                  <input
                    type="password"
                    className="glass-input glass-text-primary w-full"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    placeholder="Enter admin key"
                  />
                </div>
                <button
                  className="glass-button glass-blue w-full"
                  onClick={checkAuth}
                  disabled={loading}
                >
                  {loading ? 'Checking...' : 'Login'}
                </button>
                {error && (
                  <p className="text-red-400 text-sm">{error}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Tasks Section */}
              {currentView === 'tasks' && (
                <div className="glass-card glass-base">
                  <h2 className="text-xl font-semibold glass-text-primary mb-4">Tasks</h2>
                  
                  <div className="mb-6">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="glass-input glass-text-primary flex-1"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="New task title..."
                        onKeyPress={(e) => e.key === 'Enter' && addTask(e)}
                      />
                      <button
                        className="glass-button glass-cyan"
                        onClick={addTask}
                        disabled={loading || !newTaskTitle.trim()}
                      >
                        Add Task
                      </button>
                    </div>
                  </div>
                  
                  {loading && <LoadingPulse />}
                  {!loading && tasks.length === 0 && (
                    <p className="glass-text-muted">No tasks yet. Create your first task!</p>
                  )}
                  
                  {!loading && tasks.length > 0 && (
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <div key={task.id} className="glass-card glass-base">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="glass-text-primary font-medium">{task.title}</h3>
                              <p className="glass-text-secondary text-sm">
                                Created: {new Date(task.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <select
                                className="glass-input glass-text-primary text-sm"
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
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Strategy Lab Section */}
              {currentView === 'cards' && (
                <StrategyLab adminKey={adminKey} />
              )}

              {/* Idea Lab Section (PR-2) */}
              {currentView === 'ideas' && (
                <IdeaLab adminKey={adminKey} />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default App
