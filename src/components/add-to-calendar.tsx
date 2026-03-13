'use client'

import { useState, useRef, useEffect } from 'react'
import { CalendarPlus, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface CalendarEvent {
  title: string
  description?: string
  location?: string
  start: Date
  end: Date
}

function toIcsDateString(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function toGoogleDateString(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z')
}

function buildGoogleUrl(event: CalendarEvent) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toGoogleDateString(event.start)}/${toGoogleDateString(event.end)}`,
    details: event.description || '',
  })
  if (event.location) params.set('location', event.location)
  return `https://calendar.google.com/calendar/render?${params}`
}

function buildOutlookUrl(event: CalendarEvent) {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: event.start.toISOString(),
    enddt: event.end.toISOString(),
    body: event.description || '',
  })
  if (event.location) params.set('location', event.location)
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`
}

function buildYahooUrl(event: CalendarEvent) {
  const dur = Math.round((event.end.getTime() - event.start.getTime()) / 60000)
  const hh = String(Math.floor(dur / 60)).padStart(2, '0')
  const mm = String(dur % 60).padStart(2, '0')
  const params = new URLSearchParams({
    v: '60',
    title: event.title,
    st: toGoogleDateString(event.start),
    dur: `${hh}${mm}`,
    desc: event.description || '',
  })
  if (event.location) params.set('in_loc', event.location)
  return `https://calendar.yahoo.com/?${params}`
}

function buildIcsContent(event: CalendarEvent) {
  const desc = (event.description || '').replace(/\n/g, '\\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Revele ton Pilates//FR',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@reveletonpilates.com`,
    `DTSTART:${toIcsDateString(event.start)}`,
    `DTEND:${toIcsDateString(event.end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${desc}`,
    ...(event.location ? [`LOCATION:${event.location}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

function downloadIcsFile(event: CalendarEvent, filename: string) {
  const ics = buildIcsContent(event)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  // Fallback for WebViews: also open data URI
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl)
    const encoded = encodeURIComponent(ics)
    window.open(`data:text/calendar;charset=utf-8,${encoded}`, '_blank')
  }, 500)
}

const CALENDARS = [
  {
    id: 'google',
    name: 'Google Agenda',
    icon: '📅',
    getUrl: buildGoogleUrl,
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: '📧',
    getUrl: buildOutlookUrl,
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    icon: '📆',
    getUrl: buildYahooUrl,
  },
  {
    id: 'apple',
    name: 'Apple Calendar',
    icon: '🍎',
    getUrl: null, // Uses ICS download
  },
  {
    id: 'other',
    name: 'Autre (.ics)',
    icon: '📥',
    getUrl: null, // Uses ICS download
  },
]

interface AddToCalendarProps {
  event: CalendarEvent
  filename?: string
  accent?: 'terracotta' | 'purple'
}

export function AddToCalendar({ event, filename = 'event.ics', accent = 'terracotta' }: AddToCalendarProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const accentColor = accent === 'purple' ? '#7C3AED' : '#C6684F'
  const borderClass = accent === 'purple' ? 'border-[#7C3AED]/20' : 'border-[#DCCFBF]'
  const hoverClass = accent === 'purple'
    ? 'hover:border-[#7C3AED] hover:text-[#7C3AED]'
    : 'hover:border-[#C6684F] hover:text-[#C6684F]'

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border ${borderClass} text-sm font-medium text-[#6B6359] ${hoverClass} active:bg-[#F2E8DF] transition-colors`}
      >
        <CalendarPlus size={14} />
        Ajouter à l&apos;agenda
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/30"
              onClick={() => setOpen(false)}
            />
            {/* Bottom sheet */}
            <motion.div
              ref={ref}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl shadow-2xl safe-bottom"
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#DCCFBF]" />
              </div>
              <div className="flex items-center justify-between px-5 pb-2">
                <p className="text-sm font-semibold text-[#2C2C2C]">Ajouter à l&apos;agenda</p>
                <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F2E8DF] text-[#6B6359]">
                  <X size={16} />
                </button>
              </div>
              <div className="px-3 pb-4 space-y-1">
                {CALENDARS.map((cal) => (
                  <button
                    key={cal.id}
                    onClick={() => {
                      if (cal.getUrl) {
                        window.open(cal.getUrl(event), '_blank')
                      } else {
                        downloadIcsFile(event, filename)
                      }
                      setOpen(false)
                    }}
                    className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl text-left text-[15px] font-medium text-[#2C2C2C] hover:bg-[#FAF6F1] active:bg-[#F2E8DF] transition-colors"
                  >
                    <span className="text-xl">{cal.icon}</span>
                    {cal.name}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
