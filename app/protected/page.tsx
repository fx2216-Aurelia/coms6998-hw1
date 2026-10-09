import { createClient } from '@/lib/server';
import { redirect } from 'next/navigation';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import Link from 'next/link';

export default async function ProtectedPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 如果未登录，展示拦截/未授权界面 (Step 4.2)
    if (!user) {
        return (
            <div style={{ padding: '40px', maxWidth: '600px', margin: '60px auto', fontFamily: 'sans-serif', textAlign: 'center', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>Access Restricted</h1>
                <p style={{ color: '#4b5563', marginBottom: '24px' }}>
                    This page is protected. You must be authenticated to view this content.
                </p>
                <GoogleSignInButton />
            </div>
        );
    }

    // 4.4：查询数据库 profiles 表，检查 first_name / last_name 是否为 null
    const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

    const isProfileIncomplete = !profile?.first_name || !profile?.last_name;

    return (
        <div style={{ padding: '40px', maxWidth: '700px', margin: '40px auto', fontFamily: 'sans-serif' }}>
            {/* 4.4 Banner 提示：如果名字缺失，显示黄色警告条 */}
            {isProfileIncomplete && (
                <div style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    padding: '16px 20px',
                    borderRadius: '8px',
                    marginBottom: '24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <strong>⚠️ Incomplete Profile:</strong> Please complete your first and last name!
                    </div>
                    <Link
                        href="/profile"
                        style={{
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontWeight: '500',
                            fontSize: '14px'
                        }}
                    >
                        Complete Profile →
                    </Link>
                </div>
            )}

            <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', margin: 0 }}>🔓 Protected Route</h1>
                    <form action="/auth/signout" method="post">
                        <button
                            type="submit"
                            formAction={async () => {
                                'use server';
                                const sb = await createClient();
                                await sb.auth.signOut();
                                redirect('/protected');
                            }}
                            style={{ padding: '6px 12px', border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', borderRadius: '6px', cursor: 'pointer' }}
                        >
                            Sign out
                        </button>
                    </form>
                </div>

                <p style={{ color: '#374151', fontSize: '16px' }}>
                    Welcome back, <strong>{user.email}</strong>!
                </p>
                <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
                    User ID: <code style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{user.id}</code>
                </p>

                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f3f4f6' }}>
                    <Link href="/profile" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                        Go to Profile Management Page →
                    </Link>
                </div>
            </div>
        </div>
    );
}