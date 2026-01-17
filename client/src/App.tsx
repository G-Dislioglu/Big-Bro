import { useState, useEffect } from 'react'
import './App.css'
import { api, HealthResponse, Task, Card, CardLink, CrossingResult } from './services/api'

function App() {
  const [adminKey, setAdminKey] = useState('')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  
  // Strategy Lab state
  const [currentView, setCurrentView] = useState<'tasks' | 'cards'>('tasks')
  const [cards, setCards] = useState<Card[]>([])
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [cardLinks, setCardLinks] = useState<{ outgoing: CardLink[]; incoming: CardLink[] }>({ outgoing: [], incoming: [] })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editingCard, setEditingCard] = useState<Partial<Card> | null>(null)
  const [crossingResult, setCrossingResult] = useState<CrossingResult | null>(null)
  const [showCrossing, setShowCrossing] = useState(false)
  const [newLinkTarget, setNewLinkTarget] = useState('')
  const [newLinkType, setNewLinkType] = useState('related')
  const [newLinkStrength, setNewLinkStrength] = useState(3)

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
      fetchCards()
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

  // Strategy Lab functions
  const fetchCards = async () => {
    if (!adminKey) return
    
    setLoading(true)
    setError('')
    
    try {
      const filters: any = {}
      if (filterType) filters.type = filterType
      if (filterStatus) filters.status = filterStatus
      const data = await api.getCards(filters)
      setCards(data.cards)
    } catch (err: any) {
      if (err.message.includes('503')) {
        setError('Database not configured')
      } else {
        setError(err.message || 'Failed to fetch cards')
      }
    } finally {
      setLoading(false)
    }
  }

  const saveCard = async () => {
    if (!editingCard?.title) {
      setError('Title is required')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      if (editingCard.id) {
        await api.updateCard(editingCard.id, editingCard)
      } else {
        await api.createCard(editingCard as any)
      }
      setEditingCard(null)
      fetchCards()
    } catch (err: any) {
      setError(err.message || 'Failed to save card')
    } finally {
      setLoading(false)
    }
  }

  const deleteCard = async (id: string) => {
    setLoading(true)
    setError('')
    
    try {
      await api.deleteCard(id)
      fetchCards()
      if (selectedCard?.id === id) {
        setSelectedCard(null)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete card')
    } finally {
      setLoading(false)
    }
  }

  const selectCard = async (card: Card) => {
    setSelectedCard(card)
    setLoading(true)
    
    try {
      const links = await api.getCardLinks(card.id)
      setCardLinks(links)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch links')
    } finally {
      setLoading(false)
    }
  }

  const createLink = async () => {
    if (!selectedCard || !newLinkTarget) return
    
    setLoading(true)
    setError('')
    
    try {
      await api.createCardLink({
        from_card_id: selectedCard.id,
        to_card_id: newLinkTarget,
        link_type: newLinkType,
        strength: newLinkStrength,
        note: ''
      })
      const links = await api.getCardLinks(selectedCard.id)
      setCardLinks(links)
      setNewLinkTarget('')
      setNewLinkType('related')
      setNewLinkStrength(3)
    } catch (err: any) {
      setError(err.message || 'Failed to create link')
    } finally {
      setLoading(false)
    }
  }

  const deleteLink = async (linkId: string) => {
    setLoading(true)
    setError('')
    
    try {
      await api.deleteCardLink(linkId)
      if (selectedCard) {
        const links = await api.getCardLinks(selectedCard.id)
        setCardLinks(links)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete link')
    } finally {
      setLoading(false)
    }
  }

  const runCrossing = async (mode: 'bridge' | 'critique' | 'combine') => {
    if (!selectedCard) return
    
    setLoading(true)
    setError('')
    
    try {
      const result = await api.runCrossing({
        seedCardIds: [selectedCard.id],
        mode,
        goal: ''
      })
      setCrossingResult(result)
      setShowCrossing(true)
    } catch (err: any) {
      setError(err.message || 'Failed to run crossing')
    } finally {
      setLoading(false)
    }
  }

  const approveSuggestedCard = async (card: Card & { score?: number; reason?: string }) => {
    setLoading(true)
    setError('')
    
    try {
      // Remove extra properties before sending to API
      const { score, reason, ...cardData } = card
      await api.createCard(cardData)
      fetchCards()
      setShowCrossing(false)
      setCrossingResult(null)
    } catch (err: any) {
      setError(err.message || 'Failed to approve card')
    } finally {
      setLoading(false)
    }
  }

  const approveSuggestedLink = async (link: any) => {
    setLoading(true)
    setError('')
    
    try {
      await api.createCardLink(link)
      if (selectedCard) {
        const links = await api.getCardLinks(selectedCard.id)
        setCardLinks(links)
      }
      // Remove approved link from suggestions
      if (crossingResult) {
        setCrossingResult({
          ...crossingResult,
          suggestedLinks: crossingResult.suggestedLinks.filter(
            l => l.from_card_id !== link.from_card_id || l.to_card_id !== link.to_card_id
          )
        })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve link')
    } finally {
      setLoading(false)
    }
  }

  const filteredCards = cards.filter(card => {
    if (searchTerm && !card.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !card.content?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    return true
  })

  useEffect(() => {
    if (authenticated && (filterType !== '' || filterStatus !== '')) {
      fetchCards()
    }
  }, [filterType, filterStatus])

  return (
    <div className="app">
      <div className="container">
        <h1>Big-Bro v0.2</h1>
        
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

        {/* View Selector */}
        {authenticated && (
          <div className="card">
            <div className="view-selector">
              <button 
                className={currentView === 'tasks' ? 'active' : ''} 
                onClick={() => setCurrentView('tasks')}
              >
                Tasks
              </button>
              <button 
                className={currentView === 'cards' ? 'active' : ''} 
                onClick={() => setCurrentView('cards')}
              >
                Strategy Lab
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && <p className="error">{error}</p>}

        {/* Tasks Section */}
        {authenticated && currentView === 'tasks' && (
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

        {/* Strategy Lab Section */}
        {authenticated && currentView === 'cards' && (
          <>
            <div className="card">
              <h2>Strategy Lab</h2>
              
              {/* Search and Filters */}
              <div className="card-filters">
                <input
                  type="text"
                  placeholder="Search cards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  <option value="idea">Idea</option>
                  <option value="strategy">Strategy</option>
                  <option value="bridge">Bridge</option>
                  <option value="critique">Critique</option>
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
                <button onClick={() => setEditingCard({ title: '', type: 'idea', content: '', tags: '', status: 'draft' })}>
                  New Card
                </button>
              </div>

              {/* Cards List */}
              {loading && <p>Loading...</p>}
              {!loading && filteredCards.length === 0 && (
                <p className="no-tasks">No cards found. Create your first card!</p>
              )}
              {!loading && filteredCards.length > 0 && (
                <div className="cards-grid">
                  {filteredCards.map((card) => (
                    <div key={card.id} className={`card-item ${selectedCard?.id === card.id ? 'selected' : ''}`} onClick={() => selectCard(card)}>
                      <h3>{card.title}</h3>
                      <p className="card-meta">
                        <span className="badge">{card.type}</span>
                        <span className="badge">{card.status}</span>
                      </p>
                      {card.tags && <p className="card-tags">{card.tags}</p>}
                      <div className="card-actions">
                        <button onClick={(e) => { e.stopPropagation(); setEditingCard(card); }}>Edit</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteCard(card.id); }}>Archive</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card Editor */}
            {editingCard && (
              <div className="card">
                <h2>{editingCard.id ? 'Edit Card' : 'New Card'}</h2>
                <div className="card-editor">
                  <input
                    type="text"
                    placeholder="Title"
                    value={editingCard.title || ''}
                    onChange={(e) => setEditingCard({ ...editingCard, title: e.target.value })}
                  />
                  <select
                    value={editingCard.type || 'idea'}
                    onChange={(e) => setEditingCard({ ...editingCard, type: e.target.value })}
                  >
                    <option value="idea">Idea</option>
                    <option value="strategy">Strategy</option>
                    <option value="bridge">Bridge</option>
                    <option value="critique">Critique</option>
                  </select>
                  <textarea
                    placeholder="Content"
                    value={editingCard.content || ''}
                    onChange={(e) => setEditingCard({ ...editingCard, content: e.target.value })}
                    rows={4}
                  />
                  <input
                    type="text"
                    placeholder="Tags (comma-separated)"
                    value={editingCard.tags || ''}
                    onChange={(e) => setEditingCard({ ...editingCard, tags: e.target.value })}
                  />
                  <select
                    value={editingCard.status || 'draft'}
                    onChange={(e) => setEditingCard({ ...editingCard, status: e.target.value })}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                  <div className="card-editor-actions">
                    <button onClick={saveCard} disabled={loading}>Save</button>
                    <button onClick={() => setEditingCard(null)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Card Links */}
            {selectedCard && !editingCard && (
              <div className="card">
                <h2>Links for: {selectedCard.title}</h2>
                
                <div className="links-section">
                  <h3>Outgoing Links ({cardLinks.outgoing.length})</h3>
                  {cardLinks.outgoing.map((link) => (
                    <div key={link.id} className="link-item">
                      <span>{link.link_type} → {link.to_card_title} ({link.to_card_type})</span>
                      <span>Strength: {link.strength}/5</span>
                      <button onClick={() => deleteLink(link.id)}>Delete</button>
                    </div>
                  ))}
                  {cardLinks.outgoing.length === 0 && <p>No outgoing links</p>}

                  <h3>Incoming Links ({cardLinks.incoming.length})</h3>
                  {cardLinks.incoming.map((link) => (
                    <div key={link.id} className="link-item">
                      <span>{link.from_card_title} ({link.from_card_type}) → {link.link_type}</span>
                      <span>Strength: {link.strength}/5</span>
                    </div>
                  ))}
                  {cardLinks.incoming.length === 0 && <p>No incoming links</p>}

                  <h3>Create New Link</h3>
                  <div className="create-link-form">
                    <select value={newLinkTarget} onChange={(e) => setNewLinkTarget(e.target.value)}>
                      <option value="">Select target card...</option>
                      {cards.filter(c => c.id !== selectedCard.id).map(c => (
                        <option key={c.id} value={c.id}>{c.title} ({c.type})</option>
                      ))}
                    </select>
                    <select value={newLinkType} onChange={(e) => setNewLinkType(e.target.value)}>
                      <option value="supports">Supports</option>
                      <option value="contradicts">Contradicts</option>
                      <option value="bridges">Bridges</option>
                      <option value="related">Related</option>
                    </select>
                    <select value={newLinkStrength} onChange={(e) => setNewLinkStrength(parseInt(e.target.value))}>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                    </select>
                    <button onClick={createLink} disabled={!newLinkTarget || loading}>Create Link</button>
                  </div>

                  <h3>Crossing Heuristic</h3>
                  <div className="crossing-buttons">
                    <button onClick={() => runCrossing('bridge')}>Bridge Mode</button>
                    <button onClick={() => runCrossing('critique')}>Critique Mode</button>
                    <button onClick={() => runCrossing('combine')}>Combine Mode</button>
                  </div>
                </div>
              </div>
            )}

            {/* Crossing Results */}
            {showCrossing && crossingResult && (
              <div className="card">
                <h2>Crossing Results ({crossingResult.mode} mode)</h2>
                <button onClick={() => setShowCrossing(false)} className="close-crossing">Close</button>
                
                <h3>Suggested Cards ({crossingResult.suggestedCards.length})</h3>
                {crossingResult.suggestedCards.map((card, idx) => (
                  <div key={idx} className="suggestion-item">
                    <div>
                      <strong>{card.title}</strong> ({card.type})
                      <p>{card.reason} (score: {card.score})</p>
                    </div>
                    <div className="suggestion-actions">
                      <button onClick={() => approveSuggestedCard(card)}>Approve</button>
                      <button onClick={() => {
                        setCrossingResult({
                          ...crossingResult,
                          suggestedCards: crossingResult.suggestedCards.filter((_, i) => i !== idx)
                        });
                      }}>Reject</button>
                    </div>
                  </div>
                ))}
                {crossingResult.suggestedCards.length === 0 && <p>No card suggestions</p>}

                <h3>Suggested Links ({crossingResult.suggestedLinks.length})</h3>
                {crossingResult.suggestedLinks.map((link, idx) => (
                  <div key={idx} className="suggestion-item">
                    <div>
                      <span>{link.link_type} (strength: {link.strength}/5)</span>
                      <p>{link.note}</p>
                    </div>
                    <div className="suggestion-actions">
                      <button onClick={() => approveSuggestedLink(link)}>Approve</button>
                      <button onClick={() => {
                        setCrossingResult({
                          ...crossingResult,
                          suggestedLinks: crossingResult.suggestedLinks.filter((_, i) => i !== idx)
                        });
                      }}>Reject</button>
                    </div>
                  </div>
                ))}
                {crossingResult.suggestedLinks.length === 0 && <p>No link suggestions</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App
