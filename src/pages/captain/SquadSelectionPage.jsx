// pavilion-web/src/pages/captain/SquadSelectionPage.jsx

import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import AppShell from '../../components/layout/AppShell.jsx'
import ConfirmModal from '../../components/ui/ConfirmModal.jsx'
import { AVAILABILITY_CONFIG } from '../../lib/constants.js'

// ─── CONFIGURABLE ─────────────────────────────────
const SQUAD_SIZE = 11

export default function SquadSelectionPage() {
  const { fixtureId } = useParams()
  const navigate      = useNavigate()
  const profile       = useAuthStore(state => state.profile)

  const [fixture,      setFixture]      = useState(null)
  const [players,      setPlayers]      = useState([])
  const [squad,        setSquad]        = useState(null)
  const [selected,     setSelected]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [publishModal, setPublishModal] = useState(false)
  const [unlockModal,  setUnlockModal]  = useState(false)

  useEffect(() => { document.title = 'Pavilion · Select Squad' }, [])
  useEffect(() => { if (profile?.id && fixtureId) loadAll() }, [profile?.id, fixtureId])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([fetchFixture(), fetchSquad()])
    setLoading(false)
  }

  const fetchFixture = async () => {
    const { data, error } = await supabase
      .from('fixtures')
      .select('*, teams(id, name)')
      .eq('id', fixtureId)
      .single()

    if (error || !data) { toast.error('Fixture not found'); navigate(-1); return }
    setFixture(data)
    await fetchPlayers(data.team_id, data.match_date)
  }

  const fetchPlayers = async (teamId, matchDate) => {
    const { data: members } = await supabase
      .from('team_members')
      .select('player_id, profiles(id, full_name, avatar_color)')
      .eq('team_id', teamId)
      .eq('status', 'active')

    if (!members) return

    const { data: avail } = await supabase
      .from('availability')
      .select('player_id, status')
      .eq('fixture_id', fixtureId)

    const availMap = {}
    avail?.forEach(a => { availMap[a.player_id] = a.status })

    // ── Check conflicts: players already in another published squad on same date ──
    const { data: sameDay } = await supabase
      .from('fixtures')
      .select('id')
      .eq('match_date', matchDate)
      .neq('id', fixtureId)

    let conflictIds = []
    if (sameDay && sameDay.length > 0) {
      const sameDayIds = sameDay.map(f => f.id)
      const { data: squadRows } = await supabase
        .from('squads')
        .select('id, fixture_id, squad_members(player_id)')
        .in('fixture_id', sameDayIds)
        .eq('published', true)

      squadRows?.forEach(sq => {
        sq.squad_members?.forEach(sm => conflictIds.push(sm.player_id))
      })
    }

    const statusOrder = { available: 0, tentative: 1, unavailable: 3 }

    const list = members.map(m => ({
      id:       m.player_id,
      name:     m.profiles?.full_name || 'Unknown',
      color:    m.profiles?.avatar_color || '#F5C518',
      status:   availMap[m.player_id] || null,
      conflict: conflictIds.includes(m.player_id),
    })).sort((a, b) => {
      const orderA = a.status ? (statusOrder[a.status] ?? 2) : 2
      const orderB = b.status ? (statusOrder[b.status] ?? 2) : 2
      return orderA - orderB
    })

    setPlayers(list)
  }

  const fetchSquad = async () => {
    const { data } = await supabase
      .from('squads')
      .select('*, squad_members(player_id, position_order)')
      .eq('fixture_id', fixtureId)
      .single()

    if (data) {
      setSquad(data)
      const sorted = [...(data.squad_members || [])]
        .sort((a, b) => (a.position_order || 0) - (b.position_order || 0))
        .map(sm => sm.player_id)
      setSelected(sorted)
    }
  }

  // ── Toggle player selection ──
  const togglePlayer = (playerId) => {
    if (squad?.published) return

    const isSelected = selected.includes(playerId)
    if (!isSelected && selected.length >= SQUAD_SIZE) {
      toast.error('Squad is full — maximum ' + SQUAD_SIZE + ' players')
      return
    }
    const player = players.find(p => p.id === playerId)
    if (!isSelected && player?.conflict) {
      toast.error('This player is already in another squad today')
      return
    }
    setSelected(prev =>
      isSelected ? prev.filter(id => id !== playerId) : [...prev, playerId]
    )
  }

  // ── Save draft ──
  const handleSave = async () => {
    setSaving(true)
    try {
      let squadId = squad?.id

      if (squadId) {
        await supabase.from('squad_members').delete().eq('squad_id', squadId)
      } else {
        const { data: newSquad, error } = await supabase
          .from('squads')
          .insert({ fixture_id: fixtureId })
          .select()
          .single()
        if (error) throw error
        squadId = newSquad.id
        setSquad(newSquad)
      }

      if (selected.length > 0) {
        await supabase.from('squad_members').insert(
          selected.map((pid, i) => ({
            squad_id:       squadId,
            player_id:      pid,
            position_order: i + 1,
          }))
        )
      }

      toast.success('Squad saved')
      await fetchSquad()
      return squadId
    } catch (err) {
      toast.error('Failed to save squad: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Publish squad ──
  const handlePublish = async () => {
    setPublishModal(false)
    setSaving(true)
    try {
      const squadId = await handleSave()
      if (!squadId) return

      const { error } = await supabase
        .from('squads')
        .update({
          published:    true,
          published_at: new Date().toISOString(),
          published_by: profile.id,
        })
        .eq('id', squadId)

      if (error) throw error
      toast.success('Squad published!')
      await loadAll()
    } catch (err) {
      toast.error('Failed to publish squad: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Unlock published squad for editing ──
  const handleUnlock = async () => {
    setUnlockModal(false)
    setSaving(true)
    try {
      const { error } = await supabase
        .from('squads')
        .update({ published: false, published_at: null, published_by: null })
        .eq('id', squad.id)

      if (error) throw error
      toast('Squad unlocked for editing', { icon: '🔓' })
      await loadAll()
    } catch (err) {
      toast.error('Failed to unlock squad: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Derived ──
  const isPublished     = squad?.published || false
  const availableCount  = players.filter(p => p.status === 'available').length
  const selectedPlayers = useMemo(() =>
    selected.map(id => players.find(p => p.id === id)).filter(Boolean),
    [selected, players]
  )

  const getInitials = (name) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  // ── Squad counter colour ──
  const squadCountColor =
    selected.length === SQUAD_SIZE ? 'var(--green)' :
    selected.length >= 8           ? 'var(--amber)' :
    'var(--text-muted)'

  // ── Publish button active ──
  const canPublish = selected.length === SQUAD_SIZE && !saving

  if (loading) {
    return (
      <AppShell>
        <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>
          Loading squad selection…
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '28px' }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px', padding: 0,
          }}>
            ← Back to Fixtures
          </button>

          <div className="section-label">Squad Selection</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(22px, 4vw, 38px)',
                letterSpacing: '2px', lineHeight: 1, marginBottom: '8px',
              }}>
                HTCC VS {fixture?.opponent?.toUpperCase()}
              </h1>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span>📅 {fixture && format(parseISO(fixture.match_date), 'EEEE d MMMM yyyy')}</span>
                <span>🕐 {fixture?.match_time?.slice(0, 5)}</span>
                <span>📍 {fixture?.venue}</span>
                <span style={{ color: 'var(--gold)', fontWeight: 600 }}>🏏 {fixture?.teams?.name}</span>
              </div>
            </div>

            {isPublished && (
              <div style={{
                padding: '10px 20px', borderRadius: 'var(--radius-md)',
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                color: 'var(--green)', fontWeight: 700, fontSize: '13px', letterSpacing: '1px',
              }}>
                ✓ SQUAD PUBLISHED
              </div>
            )}
          </div>
        </div>

        {/* ── Main layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>

          {/* ── LEFT: Player pool ── */}
          <div>
            <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Team Players ({players.length})
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {availableCount} available · click to select
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {players.map(player => {
                const isSelected = selected.includes(player.id)
                const isConflict = player.conflict && !isSelected
                const cfg        = player.status ? AVAILABILITY_CONFIG[player.status] : null
                const canSelect  = !isPublished && !isConflict

                const rowBackground = isSelected
                  ? 'rgba(245,197,24,0.06)'
                  : isConflict
                    ? 'rgba(239,68,68,0.04)'
                    : 'var(--bg-surface)'

                const rowBorder = isSelected
                  ? '1px solid rgba(245,197,24,0.5)'
                  : isConflict
                    ? '1px solid rgba(239,68,68,0.2)'
                    : '1px solid var(--navy-border)'

                return (
                  <div
                    key={player.id}
                    onClick={() => canSelect && togglePlayer(player.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: rowBorder,
                      background: rowBackground,
                      cursor: canSelect ? 'pointer' : isPublished ? 'default' : 'not-allowed',
                      opacity: isConflict ? 0.6 : 1,
                      transition: 'var(--transition)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Position number circle */}
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                        border: isSelected ? '2px solid var(--gold)' : '2px solid var(--navy-border)',
                        background: isSelected ? 'var(--gold)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px',
                        color: isSelected ? 'var(--navy)' : 'transparent',
                        fontWeight: 700, transition: 'var(--transition)',
                      }}>
                        {isSelected ? selected.indexOf(player.id) + 1 : ''}
                      </div>

                      {/* Avatar */}
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                        background: player.color + '22',
                        border: '1px solid ' + player.color + '44',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 700, color: player.color,
                      }}>
                        {getInitials(player.name)}
                      </div>

                      <div>
                        <div style={{ fontWeight: isSelected ? 700 : 500, fontSize: '14px', color: 'var(--text-primary)' }}>
                          {player.name}
                        </div>
                        {isConflict && (
                          <div style={{ fontSize: '11px', color: 'var(--red)' }}>
                            Already in another squad today
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Availability badge */}
                    {cfg ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        fontSize: '12px', fontWeight: 600, color: cfg.color,
                        background: cfg.fillColor,
                        padding: '4px 10px', borderRadius: '6px',
                        border: '1px solid ' + cfg.color + '33',
                      }}>
                        <div style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: cfg.color, boxShadow: '0 0 4px ' + cfg.color,
                        }} />
                        {player.status === 'available' ? 'Available'
                          : player.status === 'unavailable' ? 'Unavailable'
                          : 'Tentative'}
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '12px', color: 'rgba(255,255,255,0.25)',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '4px 10px', borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        No reply
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── RIGHT: Squad panel ── */}
          <div style={{ position: 'sticky', top: '84px' }}>
            <div className="card" style={{
              overflow: 'hidden',
              border: isPublished
                ? '1px solid rgba(34,197,94,0.3)'
                : '1px solid var(--navy-border)',
            }}>
              {/* Panel header */}
              <div style={{
                padding: '16px 20px',
                background: isPublished
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.08), var(--bg-elevated))'
                  : 'linear-gradient(135deg, var(--bg-elevated), var(--navy-mid))',
                borderBottom: '1px solid var(--navy-border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', letterSpacing: '1px' }}>
                    SQUAD
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '20px', fontWeight: 700,
                    color: squadCountColor,
                  }}>
                    {selected.length}/{SQUAD_SIZE}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{
                  height: '4px', background: 'rgba(255,255,255,0.06)',
                  borderRadius: '2px', overflow: 'hidden', marginTop: '10px',
                }}>
                  <div style={{
                    height: '100%', borderRadius: '2px', transition: 'width 0.3s',
                    width: ((selected.length / SQUAD_SIZE) * 100) + '%',
                    background: selected.length === SQUAD_SIZE
                      ? 'var(--green)'
                      : selected.length >= 8
                        ? 'var(--amber)'
                        : 'var(--gold)',
                  }} />
                </div>
              </div>

              {/* Squad list */}
              <div style={{ padding: '8px 0', minHeight: '200px' }}>
                {selectedPlayers.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Click players on the left to add them to the squad
                  </div>
                ) : (
                  selectedPlayers.map((player, index) => (
                    <div key={player.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '9px 16px',
                      borderBottom: index < selectedPlayers.length - 1
                        ? '1px solid rgba(255,255,255,0.04)'
                        : 'none',
                    }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        background: 'var(--gold)', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, color: 'var(--navy)',
                      }}>
                        {index + 1}
                      </div>

                      <div style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {player.name}
                      </div>

                      {player.status && AVAILABILITY_CONFIG[player.status] && (
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: AVAILABILITY_CONFIG[player.status].color,
                          boxShadow: '0 0 6px ' + AVAILABILITY_CONFIG[player.status].color,
                          flexShrink: 0,
                        }} />
                      )}

                      {!isPublished && (
                        <button
                          onClick={() => togglePlayer(player.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-faint)', fontSize: '16px',
                            padding: '0 2px', lineHeight: 1, flexShrink: 0,
                          }}
                          title="Remove from squad"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Action buttons — unpublished */}
              {!isPublished && (
                <div style={{ padding: '16px', borderTop: '1px solid var(--navy-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={handleSave}
                    disabled={saving || selected.length === 0}
                    className="btn btn--secondary"
                    style={{ width: '100%' }}
                  >
                    {saving ? 'Saving…' : '💾 Save Draft'}
                  </button>

                  <button
                    onClick={() => {
                      if (selected.length < SQUAD_SIZE) {
                        toast.error('Select all ' + SQUAD_SIZE + ' players before publishing')
                        return
                      }
                      setPublishModal(true)
                    }}
                    disabled={!canPublish}
                    style={{
                      width: '100%', padding: '13px',
                      borderRadius: 'var(--radius-md)',
                      background: canPublish
                        ? 'linear-gradient(135deg, var(--gold), var(--gold-muted))'
                        : 'rgba(255,255,255,0.04)',
                      border: 'none',
                      cursor: canPublish ? 'pointer' : 'not-allowed',
                      color: canPublish ? 'var(--navy)' : 'var(--text-faint)',
                      fontSize: '14px', fontWeight: 700,
                      letterSpacing: '0.5px', transition: 'var(--transition)',
                    }}
                  >
                    🚀 Publish Squad
                  </button>

                  {selected.length > 0 && selected.length < SQUAD_SIZE && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      {SQUAD_SIZE - selected.length} more player{SQUAD_SIZE - selected.length !== 1 ? 's' : ''} needed to publish
                    </div>
                  )}
                </div>
              )}

              {/* Published footer */}
              {isPublished && squad?.published_at && (
                <div style={{
                  padding: '14px 16px',
                  borderTop: '1px solid rgba(34,197,94,0.2)',
                  background: 'rgba(34,197,94,0.05)',
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--green)', textAlign: 'center', marginBottom: '10px' }}>
                    ✓ Published {format(parseISO(squad.published_at), 'EEE d MMM, HH:mm')}
                  </div>
                  <button
                    onClick={() => setUnlockModal(true)}
                    style={{
                      width: '100%', padding: '10px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(245,197,24,0.08)',
                      border: '1px solid rgba(245,197,24,0.25)',
                      color: 'var(--gold)', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', transition: 'var(--transition)',
                    }}
                  >
                    ✏️ Edit and Re-publish Squad
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Unlock modal ── */}
      <ConfirmModal
        isOpen={unlockModal}
        title="Unlock Squad"
        message={'Unpublish the squad for vs ' + fixture?.opponent + ' so you can make changes? You will need to re-publish when done.'}
        confirmLabel="Unlock and Edit"
        cancelLabel="Keep Published"
        confirmDanger={false}
        onConfirm={handleUnlock}
        onCancel={() => setUnlockModal(false)}
      />

      {/* ── Publish modal ── */}
      <ConfirmModal
        isOpen={publishModal}
        title="Publish Squad"
        message={'Publish this squad of ' + selected.length + ' players for the match vs ' + fixture?.opponent + '? The squad will be locked after publishing.'}
        confirmLabel="Publish Squad"
        cancelLabel="Not Yet"
        confirmDanger={false}
        onConfirm={handlePublish}
        onCancel={() => setPublishModal(false)}
      />
    </AppShell>
  )
}