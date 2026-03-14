import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Skip auth checks if Supabase is not properly configured
  const isConfigured = supabaseUrl
    && supabaseKey
    && supabaseUrl.startsWith('https://')
    && supabaseUrl.includes('.supabase.co')
    && !supabaseUrl.includes('demo.supabase.co')
    && !supabaseUrl.includes('placeholder')

  if (!isConfigured) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/callback', '/api/', '/expired']
  const isPublicRoute = publicRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isPublicRoute && request.nextUrl.pathname !== '/callback') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Check if user has completed onboarding
  if (user && !isPublicRoute && !request.nextUrl.pathname.startsWith('/onboarding') && !request.nextUrl.pathname.startsWith('/expired')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed, subscription_start, is_admin, is_teacher')
      .eq('id', user.id)
      .single()

    if (profile && !profile.onboarding_completed) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    // Check subscription expiry (skip for admins/teachers)
    if (profile && !profile.is_admin && !profile.is_teacher && profile.subscription_start) {
      const endDate = new Date(profile.subscription_start)
      endDate.setFullYear(endDate.getFullYear() + 1)
      if (new Date() > endDate) {
        const url = request.nextUrl.clone()
        url.pathname = '/expired'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
