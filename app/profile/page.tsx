'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { createClient } from '@/lib/client';
import Link from 'next/link';

export default function ProfilePage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // 表单状态
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    // 成功/错误消息提示
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        async function loadProfile() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/protected';
                return;
            }
            setUserId(user.id);

            const { data, error } = await supabase
                .from('profiles')
                .select('first_name, last_name, avatar_url')
                .eq('id', user.id)
                .single();

            if (data) {
                setFirstName(data.first_name || '');
                setLastName(data.last_name || '');
                setAvatarUrl(data.avatar_url || null);
            }
            setLoading(false);
        }

        loadProfile();
    }, []);

    // 4.5 保存姓名
    const handleUpdateName = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;
        setSaving(true);
        setMessage(null);

        const { error } = await supabase
            .from('profiles')
            .update({
                first_name: firstName,
                last_name: lastName,
            })
            .eq('id', userId);

        setSaving(false);
        if (error) {
            setMessage({ type: 'error', text: error.message });
        } else {
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        }
    };

    // 4.6 上传头像到 avatars bucket 并更新 avatar_url
    const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            setMessage(null);

            if (!e.target.files || e.target.files.length === 0 || !userId) {
                return;
            }

            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const filePath = `${userId}-${Math.random()}.${fileExt}`;

            // 1. 上传到 avatars bucket
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. 获取 public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // 3. 更新 profiles.avatar_url 字段
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', userId);

            if (updateError) throw updateError;

            setAvatarUrl(publicUrl);
            setMessage({ type: 'success', text: 'Avatar uploaded and updated successfully!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Error uploading avatar' });
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading profile...</div>;
    }

    return (
        <div style={{ maxWidth: '600px', margin: '40px auto', padding: '30px', fontFamily: 'sans-serif', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>User Profile</h1>
                <Link href="/protected" style={{ color: '#2563eb', fontSize: '14px', textDecoration: 'none' }}>
                    ← Back to Protected
                </Link>
            </div>

            {message && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    backgroundColor: message.type === 'success' ? '#def7ec' : '#fde8e8',
                    color: message.type === 'success' ? '#03543f' : '#9b1c1c',
                    border: `1px solid ${message.type === 'success' ? '#31c48d' : '#f98080'}`
                }}>
                    {message.text}
                </div>
            )}

            {/* 4.6 头像预览与上传部分 */}
            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', margin: '0 auto 16px', overflow: 'hidden', border: '2px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <span style={{ fontSize: '36px', color: '#9ca3af' }}>👤</span>
                    )}
                </div>
                <label style={{ display: 'inline-block', padding: '8px 16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                    {uploading ? 'Uploading...' : 'Upload New Avatar'}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={uploading}
                        style={{ display: 'none' }}
                    />
                </label>
            </div>

            {/* 4.5 姓名编辑表单 */}
            <form onSubmit={handleUpdateName}>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>First Name</label>
                    <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        placeholder="Enter first name"
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Last Name</label>
                    <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        placeholder="Enter last name"
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    {saving ? 'Saving...' : 'Save Profile'}
                </button>
            </form>
        </div>
    );
}