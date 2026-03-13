import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SESSION_LABELS: Record<string, string> = {
  collectif: 'Cours collectif',
  masterclass: 'Masterclass',
  faq: 'Session FAQ',
  atelier: 'Atelier',
  autre: 'Live',
}

function toIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data: live } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (!live) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get Zoom URL from app_settings (meeting_url on live may be null)
  const { data: zoomSetting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'zoom_url')
    .single()
  const meetingUrl = live.meeting_url || zoomSetting?.value || null

  const start = new Date(live.scheduled_at)
  const end = new Date(start.getTime() + live.duration_minutes * 60000)
  const typeLabel = SESSION_LABELS[live.session_type] ?? 'Live'
  const desc = [live.description, live.equipment ? `Matériel : ${live.equipment}` : '', meetingUrl ? `Lien Zoom : ${meetingUrl}` : ''].filter(Boolean).join('\\n')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Revele ton Pilates//FR',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${live.id}@reveletonpilates.com`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${typeLabel} — ${live.title}`,
    `DESCRIPTION:${desc}`,
    ...(meetingUrl ? [`LOCATION:${meetingUrl}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="live.ics"`,
    },
  })
}
