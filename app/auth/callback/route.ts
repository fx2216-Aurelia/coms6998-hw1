import { NextResponse } from 'next/server'
import { createClient } from '@/lib/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // 如果有 "next" 参数则跳转到该地址，否则默认跳回首页
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const forwardedHost = request.headers.get('x-forwarded-host') // 兼容反向代理/部署环境
            const isLocalEnv = process.env.NODE_ENV === 'development'
            if (isLocalEnv) {
                // 本地环境直接跳回本地 origin
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
            }
        }
    }

    // 认证失败或没有 code 时跳转到错误页面/首页提示
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}