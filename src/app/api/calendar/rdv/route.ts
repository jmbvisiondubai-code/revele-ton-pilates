import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

  const { data: appt } = await supabase
    .from('private_appointments')
    .select('*')
    .eq('id', id)
    .single()

  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const start = new Date(appt.scheduled_at)
  const end = new Date(start.getTime() + appt.duration_minutes * 60000)
  const desc = [appt.description, appt.meeting_url ? `Lien visio : ${appt.meeting_url}` : ''].filter(Boolean).join('\\n')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Revele ton Pilates//FR',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${appt.id}@reveletonpilates.com`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:RDV privé — ${appt.title}`,
    `DESCRIPTION:${desc}`,
    ...(appt.meeting_url ? [`LOCATION:${appt.meeting_url}`] : []),
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
      'Content-Disposition': `inline; filename="rdv.ics"`,
    },
  })
}
