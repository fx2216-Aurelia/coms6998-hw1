'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/client';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import SignOutButton from '@/components/SignOutButton';
import { castVote } from './actions/vote';

interface Vote {
    id: string;
    generation_id: string;
    user_id: string;
    vote_type: number;
}

interface Generation {
    id: string;
    user_id: string;
    prompt: string;
    output_text: string;
    created_at: string;
    votes?: Vote[];
}

export default function Home() {
    const supabase = createClient();
    const [generations, setGenerations] = useState<Generation[]>([]);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // 显示提示并在 3.5 秒后自动消失 (用于 Screenshot 4.2 的 UI blocking 拦截)
    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setCurrentUser(user);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
            setCurrentUser(session?.user ?? null);
        });

        fetchGenerations();

        return () => {
            authListener?.subscription.unsubscribe();
        };
    }, []);

    const fetchGenerations = async () => {
        const { data, error } = await supabase
            .from('generations')
            .select('*, votes(*)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Fetch error:', error);
        } else if (data) {
            setGenerations(data);
        }
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        if (!currentUser) {
            showToast('Please sign in to generate a roast.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to generate');
            }

            setPrompt('');
            await fetchGenerations();
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Generation failed');
        } finally {
            setLoading(false);
        }
    };

    // 处理点赞/踩
    const handleVote = async (generationId: string, voteType: 1 | -1) => {
        // 4.3 阻止未登录用户投票并弹出醒目提示
        if (!currentUser) {
            showToast('Please sign in to vote');
            return;
        }

        // 调用 Server Action
        const result = await castVote(generationId, voteType);
        if (result && result.error) {
            showToast(result.error);
        } else {
            await fetchGenerations();
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900 py-10 px-4 sm:px-6 lg:px-8">
            {/* 顶部醒目 Notification / Toast 提示 (Screenshot 4.2 要求) */}
            {toastMessage && (
                <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 bg-rose-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-rose-400">
                    <span className="text-xl">⚠️</span>
                    <span className="font-semibold text-sm">{toastMessage}</span>
                </div>
            )}

            {/* 顶部导航与登录按钮 */}
            <div className="max-w-3xl mx-auto flex justify-between items-center mb-8 border-b border-slate-200 pb-4">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
                    🔥 College Roast Feed
                </h1>
                <div>
                    {currentUser ? (
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-600">{currentUser.email}</span>
                            <SignOutButton />
                        </div>
                    ) : (
                        <GoogleSignInButton />
                    )}
                </div>
            </div>

            {/* 生成输入框 */}
            <section className="max-w-3xl mx-auto mb-10">
                <form onSubmit={handleGenerate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        What stressful situation should Sam roast?
                    </label>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g. Spent 12 hours debugging a typo..."
                            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 text-slate-900"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !prompt.trim()}
                            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 font-semibold text-white rounded-xl shadow transition disabled:opacity-50"
                        >
                            {loading ? 'Roasting...' : 'Generate Roast'}
                        </button>
                    </div>
                </form>
            </section>

            {/* 吐槽列表与投票评分栏 */}
            <section className="max-w-3xl mx-auto">
                <h2 className="text-xl font-bold mb-4 text-slate-700">Latest Roasts</h2>
                {generations.length === 0 ? (
                    <p className="text-slate-500 text-center py-10">No roasts yet. Generate one above!</p>
                ) : (
                    <div className="space-y-4">
                        {generations.map((item) => {
                            const score = (item.votes || []).reduce((acc, v) => acc + v.vote_type, 0);
                            const myVote = (item.votes || []).find((v) => v.user_id === currentUser?.id)?.vote_type;

                            return (
                                <div
                                    key={item.id}
                                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="text-xs font-semibold tracking-wider text-amber-700 bg-amber-50 inline-block px-2.5 py-1 rounded-md mb-2">
                                            PROMPT: {item.prompt}
                                        </div>
                                        <p className="text-slate-800 text-base leading-relaxed my-2 font-medium">
                                            "{item.output_text}"
                                        </p>
                                    </div>

                                    {/* 评分控制栏 (Phase 4.1 UI) */}
                                    <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400">
                      {new Date(item.created_at).toLocaleString()}
                    </span>

                                        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                                            {/* Upvote 按钮 */}
                                            <button
                                                onClick={() => handleVote(item.id, 1)}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold transition ${
                                                    myVote === 1
                                                        ? 'bg-emerald-600 text-white shadow-sm'
                                                        : 'hover:bg-slate-200 text-slate-700'
                                                }`}
                                                title="Upvote"
                                            >
                                                👍 <span>Up</span>
                                            </button>

                                            {/* 净得分 */}
                                            <span
                                                className={`px-2 font-black text-sm ${
                                                    score > 0
                                                        ? 'text-emerald-600'
                                                        : score < 0
                                                            ? 'text-rose-600'
                                                            : 'text-slate-600'
                                                }`}
                                            >
                        {score}
                      </span>

                                            {/* Downvote 按钮 */}
                                            <button
                                                onClick={() => handleVote(item.id, -1)}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold transition ${
                                                    myVote === -1
                                                        ? 'bg-rose-600 text-white shadow-sm'
                                                        : 'hover:bg-slate-200 text-slate-700'
                                                }`}
                                                title="Downvote"
                                            >
                                                👎 <span>Down</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}