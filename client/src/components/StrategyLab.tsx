import { useEffect, useMemo, useState } from 'react'
import { api, IdeaCard, IdeaCardLink } from '../services/api'

type CrossingMode = 'balanced' | 'creative' | 'critical'

type CrossingV02Result = {
  ok: true
  score: number
  thesis: string
  steps: string[]
  risks: string[]
  next_actions: string[]
}

function isAuthError(err: unknown) {
  const msg = String((err as any)?.message || err || '')
  return msg.includes('401') || msg.toLowerCase().includes('unauthorized')
}

function buildCrossingBody(result: CrossingV02Result) {
  const parts: string[] = []
  parts.push(result.thesis)
  parts.push('')
  parts.push('Steps:')
  for (const s of result.steps) parts.push(`- ${s}`)
  parts.push('')
  parts.push('Risks:')
  for (const r of result.risks) parts.push(`- ${r}`)
  parts.push('')
  parts.push('Next actions:')
  for (const a of result.next_actions) parts.push(`- ${a}`)
  return parts.join('\n')
}

interface StrategyLabProps {
  adminKey: string
}

export function StrategyLab({ adminKey }: StrategyLabProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [cards, setCards] = useState<IdeaCard[]>([])
  const [total, setTotal] = useState(0)

  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [status, setStatus] = useState('')

  const [selectedCard, setSelectedCard] = useState<IdeaCard | null>(null)
  const [links, setLinks] = useState<IdeaCardLink[]>([])

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [editingCard, setEditingCard] = useState<Partial<IdeaCard> | null>(null)
  const [tagsInput, setTagsInput] = useState('')

  const [newLinkTargetId, setNewLinkTargetId] = useState('')
  const [newLinkType, setNewLinkType] = useState<'supports' | 'contradicts' | 'refines' | 'depends_on'>('supports')
  const [newLinkWeight, setNewLinkWeight] = useState(50)
  const [newLinkNote, setNewLinkNote] = useState('')

  const [crossingMode, setCrossingMode] = useState<CrossingMode>('balanced')
  const [crossingResult, setCrossingResult] = useState<CrossingV02Result | null>(null)

  const limit = 50
  const [offset, setOffset] = useState(0)

  const canWrite = !!adminKey

  const fetchCards = async () => {
    setLoading(true)
    setError('')
    try {
      const filters: any = { limit, offset }
      if (q) filters.q = q
      if (tag) filters.tag = tag
      if (status) filters.status = status
      const data = await api.getIdeaCards(filters)
      setCards(data.items)
      setTotal(data.total)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cards')
    } finally {
      setLoading(false)
    }
  }

  const fetchLinks = async (cardId: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getIdeaLinksByCardId(cardId)
      setLinks(data.items)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch links')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCards()
  }, [offset])

  const filteredCards = useMemo(() => {
    return cards
  }, [cards])

  const toggleSelect = (cardId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId)
      return [...prev, cardId]
    })
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
        status: 'draft' as any,
        layer: 'Rational' as any,
        value_pct: 50 as any,
        risk_notes: '' as any,
        next_steps: '' as any
      })
      setTagsInput('')
    }
  }

  const saveCard = async () => {
    if (!editingCard?.title || editingCard.title.trim().length < 3) {
      setError('Title must be at least 3 characters')
      return
    }

    if (!canWrite) {
      setError('Admin-Key nötig')
      return
    }

    setLoading(true)
    setError('')
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
      const payload: any = {
        title: editingCard.title,
        body: editingCard.body || '',
        tags,
        status: editingCard.status || 'draft',
        layer: (editingCard as any).layer || 'Rational'
      }

      if (editingCard.id) {
        await api.updateIdeaCard(editingCard.id, payload)
      } else {
        await api.createIdeaCard(payload)
      }

      setEditingCard(null)
      setTagsInput('')
      fetchCards()
    } catch (err: any) {
      if (isAuthError(err)) setError('Admin-Key nötig')
      else setError(err.message || 'Failed to save card')
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
        setLinks([])
      }
      setSelectedIds((prev) => prev.filter((x) => x !== id))
      fetchCards()
    } catch (err: any) {
      if (isAuthError(err)) setError('Admin-Key nötig')
      else setError(err.message || 'Failed to delete card')
    } finally {
      setLoading(false)
    }
  }

  const selectCard = async (card: IdeaCard) => {
    setSelectedCard(card)
    await fetchLinks(card.id)
  }

  const createLink = async () => {
    if (!selectedCard) return
    if (!canWrite) {
      setError('Admin-Key nötig')
      return
    }
    if (!newLinkTargetId) {
      setError('Select a target card')
      return
    }

    setLoading(true)
    setError('')
    try {
      await api.createIdeaCardLink({
        from_id: selectedCard.id,
        to_id: newLinkTargetId,
        type: newLinkType,
        weight: newLinkWeight,
        note: newLinkNote
      } as any)

      await fetchLinks(selectedCard.id)
      setNewLinkTargetId('')
      setNewLinkType('supports')
      setNewLinkWeight(50)
      setNewLinkNote('')
    } catch (err: any) {
      if (isAuthError(err)) setError('Admin-Key nötig')
      else setError(err.message || 'Failed to create link')
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
      if (selectedCard) await fetchLinks(selectedCard.id)
    } catch (err: any) {
      if (isAuthError(err)) setError('Admin-Key nötig')
      else setError(err.message || 'Failed to delete link')
    } finally {
      setLoading(false)
    }
  }

  const runCrossing = async () => {
    if (!canWrite) {
      setError('Admin-Key nötig')
      return
    }
    if (selectedIds.length === 0) {
      setError('Select at least 1 card')
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await api.runCrossingV02({ cardIds: selectedIds, mode: crossingMode })
      setCrossingResult(result)
    } catch (err: any) {
      if (isAuthError(err)) setError('Admin-Key nötig')
      else setError(err.message || 'Failed to run crossing')
    } finally {
      setLoading(false)
    }
  }

  const saveCrossingAsCard = async () => {
    if (!crossingResult) return
    if (!canWrite) {
      setError('Admin-Key nötig')
      return
    }

    setLoading(true)
    setError('')
    try {
      await api.createIdeaCard({
        title: crossingResult.thesis.slice(0, 120),
        body: buildCrossingBody(crossingResult),
        tags: [],
        status: 'draft',
        layer: 'Rational'
      } as any)

      setCrossingResult(null)
      fetchCards()
    } catch (err: any) {
      if (isAuthError(err)) setError('Admin-Key nötig')
      else setError(err.message || 'Failed to save card')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setOffset(0)
    fetchCards()
  }

  const getCardTitle = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId)
    return card?.title || `${cardId.slice(0, 8)}...`
  }

  return (
    <div className="idea-lab">
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>Strategy Lab</h2>
        <div className="idea-filters">
          <input
            type="text"
            placeholder="Search title/body..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <input
            type="text"
            placeholder="Filter by tag..."
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
          <button onClick={handleSearch} disabled={loading}>Search</button>
          <button onClick={() => openEditor()} disabled={loading || !canWrite}>New Card</button>
        </div>
        {!canWrite && <p className="no-tasks">Read-only mode. Enter Admin-Key to write.</p>}
      </div>

      <div className="card">
        <h3>Cards ({total})</h3>
        {loading && <p>Loading...</p>}
        {!loading && filteredCards.length === 0 && <p>No cards found. Create your first card!</p>}

        <div className="idea-cards-grid">
          {filteredCards.map((card) => (
            <div
              key={card.id}
              className={`idea-card-item ${selectedCard?.id === card.id ? 'selected' : ''}`}
              onClick={() => selectCard(card)}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(card.id)}
                  onChange={(e) => {
                    e.stopPropagation()
                    toggleSelect(card.id)
                  }}
                />
                <h4 style={{ margin: 0 }}>{card.title}</h4>
              </div>
              <div className="idea-card-meta">
                <span className={`badge status-${card.status}`}>{card.status}</span>
              </div>
              {card.tags.length > 0 && (
                <div className="idea-card-tags">
                  {card.tags.slice(0, 3).map((t, i) => (
                    <span key={i} className="tag-chip">{t}</span>
                  ))}
                  {card.tags.length > 3 && <span className="tag-more">+{card.tags.length - 3}</span>}
                </div>
              )}
              <div className="idea-card-actions">
                <button onClick={(e) => { e.stopPropagation(); openEditor(card) }} disabled={!canWrite}>Edit</button>
                <button onClick={(e) => { e.stopPropagation(); deleteCard(card.id) }} disabled={!canWrite}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        {total > limit && (
          <div className="pagination">
            <button disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>
              Previous
            </button>
            <span>Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}</span>
            <button disabled={offset + limit >= total || loading} onClick={() => setOffset(offset + limit)}>
              Load More
            </button>
          </div>
        )}
      </div>

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
              />
            </label>

            <label>
              Body
              <textarea
                value={(editingCard as any).body || ''}
                onChange={(e) => setEditingCard({ ...editingCard, body: e.target.value } as any)}
                rows={4}
              />
            </label>

            <label>
              Tags (comma-separated)
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </label>

            <label>
              Status
              <select
                value={(editingCard as any).status || 'draft'}
                onChange={(e) => setEditingCard({ ...editingCard, status: e.target.value } as any)}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </label>

            <div className="editor-actions">
              <button onClick={saveCard} disabled={loading}>Save</button>
              <button onClick={() => { setEditingCard(null); setTagsInput('') }} disabled={loading}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {selectedCard && !editingCard && (
        <div className="card">
          <h3>Card Detail: {selectedCard.title}</h3>

          <div className="card-detail">
            <p><strong>Body:</strong> {selectedCard.body || '(empty)'}</p>
            <p><strong>Status:</strong> {selectedCard.status}</p>
            <p><strong>Tags:</strong> {selectedCard.tags.join(', ') || '(none)'}</p>
          </div>

          <h4>Links ({links.length})</h4>
          {links.length === 0 && <p>No links yet</p>}

          <div className="links-list">
            {links.map((link) => (
              <div key={link.id} className="link-item">
                <span className="link-direction">
                  {link.source_id === selectedCard.id ? '→' : '←'}
                </span>
                <span className={`badge link-type-${link.type}`}>{link.type}</span>
                <span className="link-target">
                  {link.source_id === selectedCard.id ? getCardTitle(link.target_id) : getCardTitle(link.source_id)}
                </span>
                <span className="link-weight">Weight: {link.weight}%</span>
                {link.note && <span className="link-note">{link.note}</span>}
                <button onClick={() => deleteLink(link.id)} disabled={!canWrite}>×</button>
              </div>
            ))}
          </div>

          <h4>Add Link</h4>
          <div className="add-link-form">
            <select value={newLinkTargetId} onChange={(e) => setNewLinkTargetId(e.target.value)} disabled={!canWrite}>
              <option value="">Select target card...</option>
              {cards.filter((c) => c.id !== selectedCard.id).map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <select value={newLinkType} onChange={(e) => setNewLinkType(e.target.value as any)} disabled={!canWrite}>
              <option value="supports">supports</option>
              <option value="contradicts">contradicts</option>
              <option value="refines">refines</option>
              <option value="depends_on">depends_on</option>
            </select>
            <input
              type="number"
              min="0"
              max="100"
              value={newLinkWeight}
              onChange={(e) => setNewLinkWeight(parseInt(e.target.value) || 50)}
              placeholder="Weight"
              style={{ width: '80px' }}
              disabled={!canWrite}
            />
            <input
              type="text"
              value={newLinkNote}
              onChange={(e) => setNewLinkNote(e.target.value)}
              placeholder="Note (optional)"
              disabled={!canWrite}
            />
            <button onClick={createLink} disabled={!canWrite || !newLinkTargetId || loading}>Create Link</button>
          </div>

          <h4>Crossing</h4>
          <div className="add-link-form">
            <select value={crossingMode} onChange={(e) => setCrossingMode(e.target.value as any)} disabled={!canWrite}>
              <option value="balanced">balanced</option>
              <option value="creative">creative</option>
              <option value="critical">critical</option>
            </select>
            <button onClick={runCrossing} disabled={!canWrite || loading || selectedIds.length === 0}>Run Crossing ({selectedIds.length} selected)</button>
          </div>

          {crossingResult && (
            <div className="card" style={{ marginTop: '12px' }}>
              <h3>Crossing Result</h3>
              <p><strong>Score:</strong> {crossingResult.score}</p>
              <p><strong>Thesis:</strong> {crossingResult.thesis}</p>
              <p><strong>Steps:</strong></p>
              <div className="links-list">
                {crossingResult.steps.map((s, i) => (
                  <div key={i} className="link-item"><span>{s}</span></div>
                ))}
              </div>
              <p><strong>Risks:</strong></p>
              <div className="links-list">
                {crossingResult.risks.map((r, i) => (
                  <div key={i} className="link-item"><span>{r}</span></div>
                ))}
              </div>
              <p><strong>Next actions:</strong></p>
              <div className="links-list">
                {crossingResult.next_actions.map((a, i) => (
                  <div key={i} className="link-item"><span>{a}</span></div>
                ))}
              </div>
              <button onClick={saveCrossingAsCard} disabled={!canWrite || loading}>Save as new card</button>
              <button onClick={() => setCrossingResult(null)} disabled={loading}>Close</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default StrategyLab
