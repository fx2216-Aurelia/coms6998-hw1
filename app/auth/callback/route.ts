import { NextResponse } from 'next/server'
import { createClient } from '@/lib/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // Redirect to the requested destination, or the home page by default.
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const forwardedHost = request.headers.get('x-forwarded-host') // Support reverse proxies and hosted deployments.
            const isLocalEnv = process.env.NODE_ENV === 'development'
            if (isLocalEnv) {
                // Redirect to the local origin during development.
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
            }
        }
    }

    // Return to the home page when authentication fails or no code is provided.
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}