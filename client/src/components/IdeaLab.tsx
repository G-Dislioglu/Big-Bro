import { useState, useEffect } from 'react'
import { api, IdeaCard, IdeaCardLink } from '../services/api'

interface IdeaLabProps {
  adminKey: string
}

const LAYERS = ['Rational', 'Spekulativ', 'Meta'] as const
const STATUSES = ['draft', 'tested', 'validated', 'killed'] as const
const LINK_TYPES = ['supports', 'contradicts', 'depends_on', 'variant_of'] as const

export function IdeaLab({ adminKey }: IdeaLabProps) {
  const [cards, setCards] = useState<IdeaCard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const canWrite = !!adminKey
  
  const [showImport, setShowImport] = useState(false)
  const [jsonText, setJsonText] = useState('')

  const [showAiModal, setShowAiModal] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiProvider, setAiProvider] = useState('openai')
  
  // Filters
  const [searchQ, setSearchQ] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterLayer, setFilterLayer] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 50
  
  // Selected card & links
  const [selectedCard, setSelectedCard] = useState<IdeaCard | null>(null)
  const [cardLinks, setCardLinks] = useState<IdeaCardLink[]>([])
  
  // Editor state
  const [editingCard, setEditingCard] = useState<Partial<IdeaCard> | null>(null)
  const [tagsInput, setTagsInput] = useState('')
  
  // New link form
  const [newLinkTargetId, setNewLinkTargetId] = useState('')
  const [newLinkType, setNewLinkType] = useState<string>('supports')
  const [newLinkWeight, setNewLinkWeight] = useState(50)
  const [newLinkNote, setNewLinkNote] = useState('')

  useEffect(() => {
    fetchCards()
  }, [adminKey, filterStatus, filterLayer, offset])

  const fetchCards = async () => {
    setLoading(true)
    setError('')
    try {
      const filters: any = { limit, offset }
      if (searchQ) filters.q = searchQ
      if (filterTag) filters.tag = filterTag
      if (filterStatus) filters.status = filterStatus
      if (filterLayer) filters.layer = filterLayer
      
      const data = await api.getIdeaCards(filters)
      setCards(data.items)
      setTotal(data.total)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cards')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setOffset(0)
    fetchCards()
  }

  const handleImport = async () => {
    if (!canWrite) {
      setError('Admin-Key nötig')
      return
    }
    try {
      const data = JSON.parse(jsonText)
      if (!Array.isArray(data)) throw new Error('Must be JSON array')
      for (const item of data) {
        await api.createIdeaCard({
          title: item.title,
          body: item.content || '',
          tags: item.tags || [],
          layer: 'Rational',
          type: item.type || 'text-note',
          metadata: { position: item.position, connections: item.connections }
        })
      }
      setJsonText('')
      setShowImport(false)
      fetchCards()
      setError('')
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleAiGenerate = async () => {
    if (!canWrite) {
      setError('Admin-Key nötig')
      return
    }
    try {
      const data = await api.aiGenerate({ text: aiText, provider: aiProvider })
      await api.createIdeaCard({
        title: data.title,
        body: data.description,
        tags: data.tags,
        layer: 'Rational',
        type: data.type,
        metadata: data.metadata
      })
      setAiText('')
      setShowAiModal(false)
      fetchCards()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const selectCard = async (card: IdeaCard) => {
    setSelectedCard(card)
    setLoading(true)
    try {
      const data = await api.getIdeaCardLinks(card.id)
      setCardLinks(data.items)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch links')
    } finally {
      setLoading(false)
    }
  }

  const openEditor = (card?: IdeaCard) => {
    if (card) {
      setEditingCard(card)
      setTagsInput(card.tags.join(', '))
    } else {
      setEditingCard({
        title: '',
        body: '',
        tags: [],
        layer: 'Rational',
        value_pct: 50,
        status: 'draft',
        risk_notes: '',
        next_steps: ''
      })
      setTagsInput('')
    }
  }

  const saveCard = async () => {
    if (!editingCard?.title || editingCard.title.trim().length < 3) {
      setError('Title must be at least 3 characters')
      return
    }
    if (!editingCard.layer) {
      setError('Layer is required')
      return
    }

    setLoading(true)
    setError('')
    
    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0)
    
    try {
      if (editingCard.id) {
        await api.updateIdeaCard(editingCard.id, { ...editingCard, tags })
      } else {
        await api.createIdeaCard({ ...editingCard as any, tags })
      }
      setEditingCard(null)
      setTagsInput('')
      fetchCards()
    } catch (err: any) {
      setError(err.message || 'Failed to save card')
    } finally {
      setLoading(false)
    }
  }

  const deleteCard = async (id: string) => {
    if (!canWrite) {
      setError('Admin-Key nötig')
      return
    }
    if (!confirm('Delete this card? All links will also be removed.')) return
    
    setLoading(true)
    setError('')
    try {
      await api.deleteIdeaCard(id)
      if (selectedCard?.id === id) {
        setSelectedCard(null)
        setCardLinks([])
      }
      fetchCards()
    } catch (err: any) {
      setError(err.message || 'Failed to delete card')
    } finally {
      setLoading(false)
    }
  }

  const createLink = async () => {
    if (!canWrite) {
      setError('Admin-Key nötig')
      return
    }
    if (!selectedCard || !newLinkTargetId) {
      setError('Select a target card')
      return
    }
    
    setLoading(true)
    setError('')
    try {
      await api.createIdeaCardLink({
        source_id: selectedCard.id,
        target_id: newLinkTargetId,
        type: newLinkType,
        weight: newLinkWeight,
        note: newLinkNote
      })
      const data = await api.getIdeaCardLinks(selectedCard.id)
      setCardLinks(data.items)
      setNewLinkTargetId('')
      setNewLinkType('supports')
      setNewLinkWeight(50)
      setNewLinkNote('')
    } catch (err: any) {
      setError(err.message || 'Failed to create link')
    } finally {
      setLoading(false)
    }
  }

  const deleteLink = async (linkId: string) => {
    if (!canWrite) {
      setError('Admin-Key nötig')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.deleteIdeaCardLink(linkId)
      if (selectedCard) {
        const data = await api.getIdeaCardLinks(selectedCard.id)
        setCardLinks(data.items)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete link')
    } finally {
      setLoading(false)
    }
  }

  const getCardTitle = (cardId: string) => {
    const card = cards.find(c => c.id === cardId)
    return card?.title || cardId.slice(0, 8) + '...'
  }

  return (
    <div className="idea-lab">
      {error && <p className="error">{error}</p>}
      
      {/* Filters */}
      <div className="card">
        <h2>Idea Lab</h2>
        <div className="idea-filters">
          <input
            type="text"
            placeholder="Search title/body..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <input
            type="text"
            placeholder="Filter by tag..."
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
          />
          <select value={filterLayer} onChange={(e) => setFilterLayer(e.target.value)}>
            <option value="">All Layers</option>
            {LAYERS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={handleSearch}>Search</button>
          <button onClick={() => openEditor()} disabled={!canWrite}>New Card</button>
          <button onClick={() => setShowImport(!showImport)}>Import JSON</button>
          <button onClick={() => setShowAiModal(true)}>AI Magic</button>
        </div>
        {!canWrite && <p className="no-tasks">Read-only mode. Enter Admin-Key to write.</p>}
        {showImport && (
          <div>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder="Paste JSON array..."
              rows={10}
              style={{ width: '100%', marginTop: '10px' }}
            />
            <button onClick={handleImport} style={{ marginTop: '10px' }}>Import</button>
          </div>
        )}
        {showAiModal && (
          <div>
            <h3>AI Command Center</h3>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Describe your idea..."
              rows={5}
              style={{ width: '100%', marginTop: '10px' }}
            />
            <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="grok">Grok</option>
              <option value="gemini">Gemini</option>
            </select>
            <button onClick={handleAiGenerate} style={{ marginTop: '10px' }}>Generate Idea</button>
            <button onClick={() => setShowAiModal(false)}>Cancel</button>
          </div>
        )}
      </div>

      {/* Cards List */}
      <div className="card">
        <h3>Cards ({total})</h3>
        {loading && <p>Loading...</p>}
        {!loading && cards.length === 0 && <p>No cards found. Create your first idea!</p>}
        
        <div className="idea-cards-grid">
          {cards.map(card => (
            <div 
              key={card.id} 
              className={`idea-card-item ${selectedCard?.id === card.id ? 'selected' : ''}`}
              onClick={() => selectCard(card)}
            >
              <h4>{card.title}</h4>
              {card.body && <p className="idea-card-body">{card.body}</p>}
              <div className="idea-card-meta">
                <span className={`badge layer-${card.layer.toLowerCase()}`}>{card.layer}</span>
                <span className={`badge status-${card.status}`}>{card.status}</span>
                <span className="value-badge">{card.value_pct}%</span>
              </div>
              {card.tags.length > 0 && (
                <div className="idea-card-tags">
                  {card.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="tag-chip">{tag}</span>
                  ))}
                  {card.tags.length > 3 && <span className="tag-more">+{card.tags.length - 3}</span>}
                </div>
              )}
              <div className="idea-card-actions">
                <button onClick={(e) => { e.stopPropagation(); openEditor(card); }} disabled={!canWrite}>Edit</button>
                <button onClick={(e) => { e.stopPropagation(); deleteCard(card.id); }} disabled={!canWrite}>Delete</button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Pagination */}
        {total > limit && (
          <div className="pagination">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
              Previous
            </button>
            <span>Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}</span>
            <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
              Load More
            </button>
          </div>
        )}
      </div>

      {/* Card Editor Modal */}
      {editingCard && (
        <div className="card editor-card">
          <h3>{editingCard.id ? 'Edit Card' : 'New Card'}</h3>
          <div className="idea-editor">
            <label>
              Title *
              <input
                type="text"
                value={editingCard.title || ''}
                onChange={(e) => setEditingCard({ ...editingCard, title: e.target.value })}
                placeholder="Min 3 characters"
              />
            </label>
            
            <label>
              Body
              <textarea
                value={editingCard.body || ''}
                onChange={(e) => setEditingCard({ ...editingCard, body: e.target.value })}
                rows={4}
                placeholder="Description, details..."
              />
            </label>
            
            <label>
              Tags (comma-separated)
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="tag1, tag2, tag3"
              />
            </label>
            
            <div className="editor-row">
              <label>
                Layer *
                <select
                  value={editingCard.layer || 'Rational'}
                  onChange={(e) => setEditingCard({ ...editingCard, layer: e.target.value as any })}
                >
                  {LAYERS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              
              <label>
                Status
                <select
                  value={editingCard.status || 'draft'}
                  onChange={(e) => setEditingCard({ ...editingCard, status: e.target.value as any })}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              
              <label>
                Value %
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editingCard.value_pct ?? 50}
                  onChange={(e) => setEditingCard({ ...editingCard, value_pct: parseInt(e.target.value) || 0 })}
                />
              </label>
            </div>
            
            <label>
              Risk Notes
              <textarea
                value={editingCard.risk_notes || ''}
                onChange={(e) => setEditingCard({ ...editingCard, risk_notes: e.target.value })}
                rows={2}
                placeholder="Known risks, concerns..."
              />
            </label>
            
            <label>
              Next Steps
              <textarea
                value={editingCard.next_steps || ''}
                onChange={(e) => setEditingCard({ ...editingCard, next_steps: e.target.value })}
                rows={2}
                placeholder="Action items..."
              />
            </label>
            
            <div className="editor-actions">
              <button onClick={saveCard} disabled={loading}>Save</button>
              <button onClick={() => { setEditingCard(null); setTagsInput(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Card Detail + Links */}
      {selectedCard && !editingCard && (
        <div className="card">
          <h3>Card Detail: {selectedCard.title}</h3>
          
          <div className="card-detail">
            <p><strong>Body:</strong> {selectedCard.body || '(empty)'}</p>
            <p><strong>Layer:</strong> {selectedCard.layer}</p>
            <p><strong>Status:</strong> {selectedCard.status}</p>
            <p><strong>Value:</strong> {selectedCard.value_pct}%</p>
            <p><strong>Tags:</strong> {selectedCard.tags.join(', ') || '(none)'}</p>
            {selectedCard.risk_notes && <p><strong>Risks:</strong> {selectedCard.risk_notes}</p>}
            {selectedCard.next_steps && <p><strong>Next:</strong> {selectedCard.next_steps}</p>}
          </div>

          <h4>Links ({cardLinks.length})</h4>
          {cardLinks.length === 0 && <p>No links yet</p>}
          
          <div className="links-list">
            {cardLinks.map(link => (
              <div key={link.id} className="link-item">
                <span className="link-direction">
                  {link.source_id === selectedCard.id ? '→' : '←'}
                </span>
                <span className={`badge link-type-${link.type}`}>{link.type}</span>
                <span className="link-target">
                  {link.source_id === selectedCard.id 
                    ? getCardTitle(link.target_id) 
                    : getCardTitle(link.source_id)}
                </span>
                <span className="link-weight">Weight: {link.weight}%</span>
                {link.note && <span className="link-note">{link.note}</span>}
                <button onClick={() => deleteLink(link.id)}>×</button>
              </div>
            ))}
          </div>

          <h4>Add Link</h4>
          <div className="add-link-form">
            <select value={newLinkTargetId} onChange={(e) => setNewLinkTargetId(e.target.value)}>
              <option value="">Select target card...</option>
              {cards.filter(c => c.id !== selectedCard.id).map(c => (
                <option key={c.id} value={c.id}>{c.title} ({c.layer})</option>
              ))}
            </select>
            <select value={newLinkType} onChange={(e) => setNewLinkType(e.target.value)}>
              {LINK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="number"
              min="0"
              max="100"
              value={newLinkWeight}
              onChange={(e) => setNewLinkWeight(parseInt(e.target.value) || 50)}
              placeholder="Weight"
              style={{ width: '80px' }}
            />
            <input
              type="text"
              value={newLinkNote}
              onChange={(e) => setNewLinkNote(e.target.value)}
              placeholder="Note (optional)"
            />
            <button onClick={createLink} disabled={!newLinkTargetId || loading}>Create Link</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default IdeaLab
