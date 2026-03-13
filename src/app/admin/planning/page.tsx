'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LiveSession, LiveSessionType, PrivateAppointment, AppointmentStatus } from '@/types/database'
import { ChevronLeft, ChevronRight, CalendarPlus, Radio, CalendarClock, Video, Users } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'

type ClientOption = { id: string; first_name: string; last_name: string; username: string }

const SESSION_TYPES: Record<LiveSessionType, { label: string; emoji: string }> = {
  collectif: { label: 'Cours collectif', emoji: '🧘' },
  masterclass: { label: 'Masterclass', emoji: '🎓' },
  faq: { label: 'Session FAQ', emoji: '❓' },
  atelier: { label: 'Atelier', emoji: '🛠️' },
  autre: { label: 'Autre', emoji: '📌' },
}

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-green-400',
  cancelled: 'bg-red-300',
  completed: 'bg-gray-300',
}

type CalendarEvent = {
  id: string
  title: string
  scheduled_at: string
  duration_minutes: number
  type: 'live' | 'rdv'
  meeting_url: string | null
  // Live-specific
  session_type?: LiveSessionType
  equipment?: string | null
  registered_count?: number
  max_participants?: number | null
  is_cancelled?: boolean
  // RDV-specific
  client?: ClientOption | null
  status?: AppointmentStatus
  description?: string | null
}

function getGoogleCalendarUrl(event: CalendarEvent) {
  const start = new Date(event.scheduled_at)
  const end = new Date(start.getTime() + event.duration_minutes * 60000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const title = event.type === 'live'
    ? `${SESSION_TYPES[event.session_type!]?.label ?? 'Live'} — ${event.title}`
    : `RDV privé — ${event.title}${event.client ? ` (${event.client.first_name} ${event.client.last_name})` : ''}`
  const details = [
    event.description,
    event.equipment ? `Matériel : ${event.equipment}` : '',
    event.meeting_url ? `Lien visio : ${event.meeting_url}` : '',
    event.client ? `Cliente : ${event.client.first_name} ${event.client.last_name}` : '',
  ].filter(Boolean).join('\n')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details,
  })
  if (event.meeting_url) params.set('location', event.meeting_url)
  return `https://calendar.google.com/calendar/render?${params}`
}

export default function AdminPlanningPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)

  const supabase = createClient()

  async function loadEvents() {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    // Load lives
    const { data: lives } = await supabase
      .from('live_sessions')
      .select('*')
      .gte('scheduled_at', calStart.toISOString())
      .lte('scheduled_at', calEnd.toISOString())
      .order('scheduled_at')

    // Load RDVs
    const { data: rdvs } = await supabase
      .from('private_appointments')
      .select('*')
      .gte('scheduled_at', calStart.toISOString())
      .lte('scheduled_at', calEnd.toISOString())
      .order('scheduled_at')

    // Load zoom URL
    const { data: zoomSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'collective_zoom_url')
      .single()
    if (zoomSetting?.value) setZoomUrl(zoomSetting.value)

    // Fetch client profiles for RDVs
    const clientIds = [...new Set((rdvs ?? []).map((r: PrivateAppointment) => r.client_id))]
    let clientMap = new Map<string, ClientOption>()
    if (clientIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, username')
        .in('id', clientIds)
      clientMap = new Map((profiles ?? []).map(p => [p.id, p as ClientOption]))
    }

    const liveEvents: CalendarEvent[] = (lives ?? []).map((l: LiveSession) => ({
      id: l.id,
      title: l.title,
      scheduled_at: l.scheduled_at,
      duration_minutes: l.duration_minutes,
      type: 'live' as const,
      meeting_url: l.meeting_url || zoomSetting?.value || null,
      session_type: l.session_type,
      equipment: l.equipment,
      registered_count: l.registered_count,
      max_participants: l.max_participants,
      is_cancelled: l.is_cancelled,
      description: l.description,
    }))

    const rdvEvents: CalendarEvent[] = (rdvs ?? []).map((r: PrivateAppointment) => ({
      id: r.id,
      title: r.title,
      scheduled_at: r.scheduled_at,
      duration_minutes: r.duration_minutes,
      type: 'rdv' as const,
      meeting_url: r.meeting_url,
      client: clientMap.get(r.client_id) || null,
      status: r.status,
      description: r.description,
    }))

    setEvents([...liveEvents, ...rdvEvents].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
  }

  useEffect(() => { loadEvents() }, [currentMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  function getEventsForDay(d: Date) {
    return events.filter(e => isSameDay(new Date(e.scheduled_at), d))
  }

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : []

  return (
    <div>
      <h2 className="font-serif text-2xl text-[#2C2C2C] mb-6">Mon planning</h2>

      {/* Month navigation */}
      <div className="bg-white rounded-xl border border-[#DCCFBF] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DCCFBF]">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-[#F2E8DF] text-[#6B6359]">
            <ChevronLeft size={18} />
          </button>
          <h3 className="font-serif text-lg text-[#2C2C2C] capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </h3>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-[#F2E8DF] text-[#6B6359]">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[#DCCFBF]">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-[#A09488] py-2">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const dayEvents = getEventsForDay(d)
            const inMonth = isSameMonth(d, currentMonth)
            const today = isToday(d)
            const selected = selectedDay && isSameDay(d, selectedDay)
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(d)}
                className={`relative min-h-[80px] p-1.5 border-b border-r border-[#F0EAE2] text-left transition-colors ${
                  !inMonth ? 'bg-[#FAF6F1]/50' : selected ? 'bg-[#C6684F]/5' : 'hover:bg-[#F2E8DF]/50'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-7 h-7 text-sm rounded-full ${
                  today ? 'bg-[#C6684F] text-white font-bold' : !inMonth ? 'text-[#DCCFBF]' : 'text-[#2C2C2C]'
                }`}>
                  {format(d, 'd')}
                </span>
                {/* Event dots */}
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 3).map(e => (
                    <div key={e.id} className={`text-[9px] leading-tight truncate rounded px-1 py-0.5 ${
                      e.type === 'live'
                        ? e.is_cancelled ? 'bg-red-100 text-red-400 line-through' : 'bg-[#C6684F]/10 text-[#C6684F]'
                        : e.status === 'cancelled' ? 'bg-red-100 text-red-400 line-through' : 'bg-[#7C3AED]/10 text-[#7C3AED]'
                    }`}>
                      {e.type === 'live' ? '🔴' : '🟣'} {format(new Date(e.scheduled_at), 'HH:mm')}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[9px] text-[#A09488] px-1">+{dayEvents.length - 3}</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-[#A09488]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C6684F]" /> Sessions live</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#7C3AED]" /> RDV privés</span>
      </div>

      {/* Selected day details */}
      {selectedDay && (
        <div className="mt-6">
          <h3 className="font-serif text-lg text-[#2C2C2C] mb-3 capitalize">
            {format(selectedDay, 'EEEE d MMMM yyyy', { locale: fr })}
          </h3>
          {selectedEvents.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#DCCFBF] py-8 text-center text-[#A09488] text-sm">
              Rien de prévu ce jour-là.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map(event => (
                <div key={event.id} className={`bg-white rounded-xl border p-4 ${
                  event.is_cancelled || event.status === 'cancelled' ? 'opacity-50 border-red-200' : 'border-[#DCCFBF]'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      event.type === 'live' ? 'bg-[#C6684F]/10' : 'bg-[#7C3AED]/10'
                    }`}>
                      {event.type === 'live'
                        ? <Radio size={18} className="text-[#C6684F]" />
                        : <CalendarClock size={18} className="text-[#7C3AED]" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-[#2C2C2C]">{event.title}</h4>
                        {event.type === 'live' && event.session_type && (
                          <span className="text-[10px] bg-[#F2E8DF] text-[#C6684F] px-1.5 py-0.5 rounded font-medium">
                            {SESSION_TYPES[event.session_type]?.emoji} {SESSION_TYPES[event.session_type]?.label}
                          </span>
                        )}
                        {event.type === 'rdv' && (
                          <span className="text-[10px] bg-[#7C3AED]/10 text-[#7C3AED] px-1.5 py-0.5 rounded font-medium">
                            RDV privé
                          </span>
                        )}
                        {event.is_cancelled && <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded font-medium">Annulé</span>}
                        {event.status === 'cancelled' && <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded font-medium">Annulé</span>}
                      </div>
                      <p className="text-sm text-[#C6684F] mt-0.5">
                        {format(new Date(event.scheduled_at), 'HH:mm', { locale: fr })} — {format(new Date(new Date(event.scheduled_at).getTime() + event.duration_minutes * 60000), 'HH:mm')} · {event.duration_minutes} min
                      </p>
                      {event.description && <p className="text-xs text-[#6B6359] mt-1">{event.description}</p>}

                      {/* Live-specific info */}
                      {event.type === 'live' && (
                        <div className="flex items-center gap-3 mt-1 text-xs text-[#6B6359]">
                          {event.max_participants ? (
                            <span className="flex items-center gap-1"><Users size={11} /> {event.registered_count}/{event.max_participants}</span>
                          ) : (
                            <span className="flex items-center gap-1"><Users size={11} /> {event.registered_count} inscrite{(event.registered_count ?? 0) !== 1 ? 's' : ''}</span>
                          )}
                          {event.equipment && <span>· Matériel : {event.equipment}</span>}
                        </div>
                      )}

                      {/* RDV-specific info */}
                      {event.type === 'rdv' && event.client && (
                        <p className="text-xs text-[#6B6359] mt-1">
                          Cliente : {event.client.first_name} {event.client.last_name} <span className="text-[#A09488]">@{event.client.username}</span>
                        </p>
                      )}

                      {/* Meeting link */}
                      {event.meeting_url && (
                        <a href={event.meeting_url} target="_blank" rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1.5 mt-1.5 text-xs font-medium ${event.type === 'live' ? 'text-[#C6684F]' : 'text-[#7C3AED]'}`}>
                          <Video size={12} /> Lien visio
                        </a>
                      )}

                      {/* Google Calendar button */}
                      <div className="mt-2">
                        <a
                          href={getGoogleCalendarUrl(event)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B6359] hover:text-[#C6684F] border border-[#DCCFBF] hover:border-[#C6684F] px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <CalendarPlus size={12} />
                          Ajouter à Google Agenda
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
