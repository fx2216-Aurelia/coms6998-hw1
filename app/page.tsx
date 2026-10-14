'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import html2canvas from 'html2canvas';
import { createClient } from '@/lib/client';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import SignOutButton from '@/components/SignOutButton';
import StoicLoader from '@/components/StoicLoader';

type ToneType = 'gentle' | 'roast';
type FeedSort = 'latest' | 'highest-stress';
type ReactionType = 'hug' | 'same_here';

interface Generation {
    id: string;
    user_id: string;
    prompt: string;
    output_text: string;
    stress_level?: number | null;
    tone_type?: ToneType | null;
    stoic_quote?: string | null;
    image_prompt?: string;
    image_url?: string;
    imageUrl?: string;
    base64Image?: string;
    imagePreloaded?: boolean;
    created_at: string;
    hug_count?: number | null;
    same_here_count?: number | null;
}

interface FeedPost extends Generation {
    readonly imageUrl: string;
    readonly imagePrompt?: string;
}

interface JournalActions {
    meditation: string;
    walk: string;
    nearby_anchor: string;
}

interface JournalContent {
    analysis: string;
    actions?: JournalActions;
    scene_theme?: string;
    image_prompt?: string;
    image_url?: string;
    location?: string;
    author_name?: string;
}

interface ReactionState {
    hug: boolean;
    same_here: boolean;
}

interface ReactionCounts {
    hug: number;
    same_here: number;
}

interface FeedComment {
    id: string;
    generation_id: string;
    content: string;
    created_at: string;
    author_name?: string | null;
}

function getJournalContent(outputText: string): JournalContent {
    try {
        const parsed: unknown = JSON.parse(outputText);
        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'analysis' in parsed &&
            typeof parsed.analysis === 'string'
        ) {
            const actions = 'actions' in parsed ? parsed.actions : undefined;
            const validActions =
                typeof actions === 'object' &&
                actions !== null &&
                'meditation' in actions &&
                typeof actions.meditation === 'string' &&
                'walk' in actions &&
                typeof actions.walk === 'string' &&
                'nearby_anchor' in actions &&
                typeof actions.nearby_anchor === 'string'
                    ? {
                          meditation: actions.meditation,
                          walk: actions.walk,
                          nearby_anchor: actions.nearby_anchor,
                      }
                    : undefined;

            return {
                analysis: parsed.analysis,
                actions: validActions,
                scene_theme: 'scene_theme' in parsed && typeof parsed.scene_theme === 'string'
                    ? parsed.scene_theme
                    : undefined,
                image_prompt: 'image_prompt' in parsed && typeof parsed.image_prompt === 'string'
                    ? parsed.image_prompt
                    : undefined,
                image_url: 'image_url' in parsed && typeof parsed.image_url === 'string'
                    ? parsed.image_url
                    : undefined,
                location: 'location' in parsed && typeof parsed.location === 'string'
                    ? parsed.location
                    : undefined,
                author_name: 'author_name' in parsed && typeof parsed.author_name === 'string'
                    ? parsed.author_name
                    : undefined,
            };
        }
    } catch {
        // Older generations store plain analysis text rather than journal JSON.
    }

    return { analysis: outputText };
}

function formatEnglishDate(dateStrOrObj: string | Date): string {
    const date = new Date(dateStrOrObj);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function createPostImageUrl(imagePrompt: string, postId: string, seed = Date.now()): string {
    const cleanPrompt = encodeURIComponent(
        `${imagePrompt}, cute storybook illustration, soft pastel colors, whimsical, original hand-painted style, high aesthetic, clean, charming diary illustration, no text`,
    );
    return `https://image.pollinations.ai/prompt/${cleanPrompt}?width=600&height=400&nologo=true&seed=${seed}`;
}

function seedFromPostId(postId: string): number {
    return [...postId].reduce(
        (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
        7,
    );
}

function toFeedPost(generation: Generation, seed?: number): FeedPost {
    const content = getJournalContent(generation.output_text);
    const imagePrompt = generation.image_prompt || content.image_prompt ||
        `A cute Columbia lion cub finding calm in ${content.location || 'Morningside'}, responding to: ${generation.prompt}`;
    const stableSeed = seed ?? seedFromPostId(generation.id);

    return {
        ...generation,
        imagePrompt,
        imageUrl: generation.imageUrl || generation.image_url || content.image_url || createPostImageUrl(imagePrompt, generation.id, stableSeed),
    };
}

function preloadImage(src: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const timeout = window.setTimeout(() => reject(new Error('Generated illustration did not finish loading.')), 30_000);
        const finish = (loaded: boolean) => {
            window.clearTimeout(timeout);
            if (loaded) resolve(src);
            else reject(new Error('Generated illustration could not be loaded.'));
        };
        image.onload = () => finish(true);
        image.onerror = () => finish(false);
        image.src = src;
    });
}

function getRenderedImageSrc(src: string): string {
    if (src.startsWith('data:image/')) return src;
    try {
        const url = new URL(src);
        if (url.hostname === 'image.pollinations.ai' || url.hostname === 'images.unsplash.com') {
            return `/api/proxy-image?url=${encodeURIComponent(url.href)}`;
        }
    } catch {
        return src;
    }
    return src;
}

function PostImage({
    src,
    preloaded = false,
    alt,
}: {
    src: string;
    preloaded?: boolean;
    alt: string;
}) {
    const [loaded, setLoaded] = useState(preloaded);
    const renderedSrc = getRenderedImageSrc(src);
    const [unavailable, setUnavailable] = useState(false);
    const hasImageUrl = Boolean(src.trim());

    const handleError = () => {
        setUnavailable(true);
        setLoaded(false);
    };

    return (
        <div className="relative flex h-56 min-h-56 w-full items-center justify-center overflow-hidden rounded-xl bg-stone-100 shadow-inner">
            {hasImageUrl && !loaded && (
                <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-[#E8F4EC] via-[#FBF5E7] to-[#E8F4EC]" />
            )}
            {hasImageUrl && !unavailable ? (
                <img
                    src={renderedSrc}
                    alt={alt || 'Stoic reflection illustration'}
                    crossOrigin="anonymous"
                    onLoad={() => {
                        setLoaded(true);
                    }}
                    onError={handleError}
                    loading="lazy"
                    className={`h-56 w-full rounded-xl object-cover transition-opacity duration-500 ${
                        loaded ? 'opacity-100' : 'opacity-0'
                    }`}
                />
            ) : (
                <div
                    className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#E8F4EC] via-[#FBF5E7] to-[#E7EEF7] px-6 text-center text-sm text-[#496B57]"
                    role="img"
                    aria-label={alt}
                >
                    {hasImageUrl ? 'Illustration temporarily unavailable' : 'Illustration is being prepared'}
                </div>
            )}
        </div>
    );
}

function relativeTime(timestamp: string): string {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
    if (elapsedSeconds < 60) return 'just now';
    if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
    if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
    return `${Math.floor(elapsedSeconds / 86400)}d ago`;
}

export default function Home() {
    const [supabase] = useState(() => createClient());
    const [generations, setGenerations] = useState<FeedPost[]>([]);
    const [latestReflection, setLatestReflection] = useState<Generation | null>(null);
    const [feedSort, setFeedSort] = useState<FeedSort>('latest');
    const [feedLoading, setFeedLoading] = useState(true);
    const [feedError, setFeedError] = useState<string | null>(null);
    const [reactions, setReactions] = useState<Record<string, ReactionState>>({});
    const [reactionCounts, setReactionCounts] = useState<Record<string, ReactionCounts>>({});
    const [pendingReactions, setPendingReactions] = useState<Record<string, boolean>>({});
    const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
    const [commentsByGeneration, setCommentsByGeneration] = useState<Record<string, FeedComment[]>>({});
    const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
    const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
    const [commentPosting, setCommentPosting] = useState<Record<string, boolean>>({});
    const reactionLocks = useRef(new Set<string>());
    const latestReflectionRef = useRef<HTMLElement>(null);
    const [prompt, setPrompt] = useState('');
    const [location, setLocation] = useState('');
    const [stressLevel, setStressLevel] = useState(5);
    const [tone, setTone] = useState<ToneType>('gentle');
    const [loading, setLoading] = useState(false);
    const [downloadingCard, setDownloadingCard] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const fetchGenerations = useCallback(async (showLoading = true) => {
        if (showLoading) setFeedLoading(true);
        setFeedError(null);
        try {
            let query = supabase.from('generations').select('*');
            query =
                feedSort === 'latest'
                    ? query.order('created_at', { ascending: false })
                    : query
                          .order('stress_level', { ascending: false, nullsFirst: false })
                          .order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;

            setGenerations(data.map((generation) => toFeedPost(generation)));
            const { data: comments, error: commentsError } = await supabase
                .from('feed_comments')
                .select('generation_id');
            if (commentsError) {
                console.error('Comment count fetch error:', commentsError);
            } else {
                const counts = comments.reduce<Record<string, number>>((result, comment) => {
                    result[comment.generation_id] = (result[comment.generation_id] ?? 0) + 1;
                    return result;
                }, {});
                setCommentCounts(counts);
            }
        } catch (error) {
            console.error('Feed fetch error:', error);
            setFeedError('The vent feed could not be loaded. Please try again.');
        } finally {
            setFeedLoading(false);
        }
    }, [feedSort, supabase]);

    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3500);
    };

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setCurrentUser(user);
        });
        const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
            setCurrentUser(session?.user ?? null);
        });

        const initialFetchTimeout = setTimeout(() => {
            void fetchGenerations();
        }, 0);

        return () => {
            clearTimeout(initialFetchTimeout);
            authListener.subscription.unsubscribe();
        };
    }, [fetchGenerations, supabase]);

    useEffect(() => {
        if (latestReflection && !loading) {
            latestReflectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [latestReflection, loading]);

    const generationCardContent = (generationId: string, type: ReactionType) => {
        const stateKey = `${currentUser?.id ?? 'anonymous'}:${generationId}`;
        if (reactions[stateKey]?.[type]) return true;
        if (typeof window === 'undefined') return false;

        try {
            return (
                localStorage.getItem(
                    `meditations-reaction:${currentUser?.id ?? 'anonymous'}:${generationId}:${type}`,
                ) === 'true'
            );
        } catch (error) {
            console.error('Could not read saved reaction state:', error);
            return false;
        }
    };

    const handleGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!prompt.trim() || !location.trim()) return;

        if (!currentUser) {
            showToast('Please sign in to generate a reflection.');
            return;
        }

        setLoading(true);
        setLatestReflection(null);
        const minimumLoadingTime = new Promise<void>((resolve) => {
            window.setTimeout(resolve, 3800);
        });
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    location,
                    stress_level: Number(stressLevel),
                    tone,
                }),
            });

            if (!response.ok) {
                const errorData: { error?: string } = await response.json();
                throw new Error(errorData.error || 'Failed to generate a reflection.');
            }

            const generated: Generation = await response.json();
            const normalizedPost = toFeedPost(generated, Date.now());
            const generatedImage = generated.base64Image || generated.imageUrl;
            if (!generatedImage?.startsWith('data:image/')) {
                throw new Error('The generation response did not include an embedded illustration.');
            }
            const imageUrl = await Promise.all([
                preloadImage(generatedImage),
                minimumLoadingTime,
            ]).then(([loadedImageUrl]) => loadedImageUrl);
            const newPost: FeedPost = {
                ...normalizedPost,
                imageUrl,
                base64Image: imageUrl,
                imagePreloaded: true,
            };
            setLatestReflection({
                ...generated,
                imageUrl: newPost.imageUrl,
                image_url: newPost.imageUrl,
                base64Image: imageUrl,
                image_prompt: newPost.imagePrompt,
                imagePreloaded: true,
            });
            setGenerations((previous) => {
                const next = [newPost, ...previous.filter((post) => post.id !== generated.id)];
                return feedSort === 'latest'
                    ? next
                    : next.sort((a, b) =>
                          (b.stress_level ?? 0) - (a.stress_level ?? 0) ||
                          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                      );
            });
            setPrompt('');
            setLocation('');
        } catch (error) {
            console.error('Reflection generation failed:', error);
            showToast('We could not create your reflection just now. Please try again shortly.');
        } finally {
            await minimumLoadingTime;
            setLoading(false);
        }
    };

    const handleDownloadCard = async (generationId: string, cardElementId = `journal-card-${generationId}`) => {
        const card = document.getElementById(cardElementId);
        if (!card) {
            showToast('Could not find the journal card to download.');
            return;
        }

        setDownloadingCard(generationId);
        try {
            const images = Array.from(card.querySelectorAll('img'));
            await Promise.all(images.map(async (image) => {
                image.loading = 'eager';
                await image.decode();
                if (image.naturalWidth === 0 || image.naturalHeight === 0) {
                    throw new Error('The card illustration did not finish loading.');
                }
            }));

            const canvas = await html2canvas(card, {
                useCORS: true,
                allowTaint: false,
                scale: 2,
                backgroundColor: '#FDFBF7',
            });
            const imageDataUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.download = 'stoic-journal.png';
            downloadLink.href = imageDataUrl;
            downloadLink.click();
        } catch (error) {
            console.error('Could not export journal card:', error);
            showToast('Could not download the Polaroid. Please try again.');
        } finally {
            setDownloadingCard(null);
        }
    };

    const handleReaction = async (generationId: string, type: ReactionType) => {
        if (!currentUser) {
            showToast('Please sign in to send a little support.');
            return;
        }

        const storageKey = `meditations-reaction:${currentUser.id}:${generationId}:${type}`;
        if (reactionLocks.current.has(storageKey)) return;
        try {
            if (localStorage.getItem(storageKey) === 'true') {
                showToast(type === 'hug' ? 'You already sent a hug for this reflection.' : 'You already said “same here” for this reflection.');
                return;
            }
        } catch (error) {
            console.error('Could not check saved reaction state:', error);
        }

        reactionLocks.current.add(storageKey);
        setPendingReactions((previous) => ({ ...previous, [storageKey]: true }));
        try {
            const { error } = await supabase.rpc(
                type === 'hug' ? 'increment_hug' : 'increment_same_here',
                { generation_id: generationId },
            );
            if (error) throw error;

            try {
                localStorage.setItem(storageKey, 'true');
            } catch (storageError) {
                console.error('Could not persist reaction state in local storage:', storageError);
                showToast('Reaction saved, but this browser could not remember it.');
            }
            const stateKey = `${currentUser.id}:${generationId}`;
            const nextReactions = {
                ...reactions,
                [stateKey]: {
                    hug: reactions[stateKey]?.hug ?? false,
                    same_here: reactions[stateKey]?.same_here ?? false,
                    [type]: true,
                },
            };
            setReactions(nextReactions);
            setReactionCounts((previous) => ({
                ...previous,
                [generationId]: {
                    hug: (previous[generationId]?.hug ?? 0) + (type === 'hug' ? 1 : 0),
                    same_here: (previous[generationId]?.same_here ?? 0) + (type === 'same_here' ? 1 : 0),
                },
            }));
            await fetchGenerations(false);
        } catch (error) {
            console.error(`Failed to send ${type} reaction:`, error);
            showToast('Your reaction could not be saved. Please try again.');
        } finally {
            reactionLocks.current.delete(storageKey);
            setPendingReactions((previous) => {
                const next = { ...previous };
                delete next[storageKey];
                return next;
            });
        }
    };

    const toggleComments = async (generationId: string) => {
        const opening = !openComments[generationId];
        setOpenComments((previous) => ({ ...previous, [generationId]: opening }));
        if (!opening || commentsByGeneration[generationId]) return;

        setCommentsLoading((previous) => ({ ...previous, [generationId]: true }));
        try {
            const { data, error } = await supabase
                .from('feed_comments')
                .select('id, generation_id, content, created_at, author_name')
                .eq('generation_id', generationId)
                .order('created_at', { ascending: true });
            if (error) throw error;

            setCommentsByGeneration((previous) => ({ ...previous, [generationId]: data }));
            setCommentCounts((previous) => ({ ...previous, [generationId]: data.length }));
        } catch (error) {
            console.error('Could not load feed comments:', error);
            showToast('Comments could not be loaded. Please close and reopen them to retry.');
            setOpenComments((previous) => ({ ...previous, [generationId]: false }));
        } finally {
            setCommentsLoading((previous) => ({ ...previous, [generationId]: false }));
        }
    };

    const handlePostComment = async (targetId: string, commentText: string) => {
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!targetId || !uuidPattern.test(targetId)) {
            console.error('Cannot post comment: generation_id is missing or is not a valid UUID.', targetId);
            alert('This reflection is not ready for comments yet. Please refresh and try again.');
            return;
        }

        const content = commentText.trim();
        if (!content) return;
        if (!currentUser) {
            showToast('Please sign in to post a comment.');
            return;
        }

        setCommentPosting((previous) => ({ ...previous, [targetId]: true }));
        const optimisticComment: FeedComment = {
            id: `optimistic-${crypto.randomUUID()}`,
            generation_id: targetId,
            content,
            created_at: new Date().toISOString(),
            author_name: 'Anonymous Morningsider',
        };
        const author = 'Anonymous Morningsider';
        setCommentsByGeneration((previous) => ({
            ...previous,
            [targetId]: [...(previous[targetId] ?? []), optimisticComment],
        }));
        setCommentCounts((previous) => ({
            ...previous,
            [targetId]: (previous[targetId] ?? 0) + 1,
        }));
        setCommentDrafts((previous) => ({ ...previous, [targetId]: '' }));

        try {
            const { data, error } = await supabase
                .from('feed_comments')
                .insert([{
                    generation_id: targetId,
                    content,
                    author_name: author || 'Anonymous Lion',
                }])
                .select();
            if (error) throw error;
            const insertedComment = data[0] as FeedComment | undefined;
            if (!insertedComment) {
                throw new Error('The comment was accepted but no saved comment was returned.');
            }

            setCommentsByGeneration((previous) => ({
                ...previous,
                [targetId]: (previous[targetId] ?? []).map((comment) =>
                    comment.id === optimisticComment.id ? insertedComment : comment,
                ),
            }));
        } catch (error) {
            console.error('Failed to post comment:', error);
            setCommentsByGeneration((previous) => ({
                ...previous,
                [targetId]: (previous[targetId] ?? []).filter(
                    (comment) => comment.id !== optimisticComment.id,
                ),
            }));
            setCommentCounts((previous) => ({
                ...previous,
                [targetId]: Math.max(0, (previous[targetId] ?? 1) - 1),
            }));
            setCommentDrafts((previous) => ({ ...previous, [targetId]: content }));
            const message = error instanceof Error ? error.message : 'Your comment could not be posted.';
            showToast(message);
            alert(message);
        } finally {
            setCommentPosting((previous) => ({ ...previous, [targetId]: false }));
        }
    };

    const renderCommentsSection = (generationId: string) => (
        <section className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800" aria-label="Comments">
            <button
                type="button"
                onClick={() => void toggleComments(generationId)}
                aria-expanded={openComments[generationId] ?? false}
                className="text-sm font-semibold text-stone-700 hover:text-stone-950 dark:text-stone-300 dark:hover:text-white"
            >
                💬 Comments ({commentCounts[generationId] ?? 0})
            </button>
            {openComments[generationId] && (
                <div className="mt-4">
                    {commentsLoading[generationId] ? (
                        <div className="space-y-3" aria-label="Loading comments">
                            {[0, 1].map((skeleton) => (
                                <div key={skeleton} className="animate-pulse">
                                    <div className="mb-2 h-3 w-28 rounded bg-stone-200 dark:bg-stone-700" />
                                    <div className="h-4 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(commentsByGeneration[generationId] ?? []).map((comment) => (
                                <div key={comment.id} className="rounded-xl bg-stone-50 px-4 py-3 dark:bg-stone-950">
                                    <div className="mb-1 flex items-center justify-between gap-3">
                                        <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                                            {comment.author_name || 'Anonymous Morningsider'}
                                        </span>
                                        <time dateTime={comment.created_at} className="text-xs text-stone-500 dark:text-stone-400">
                                            {relativeTime(comment.created_at)}
                                        </time>
                                    </div>
                                    <p className="text-sm text-stone-700 dark:text-stone-200">{comment.content}</p>
                                </div>
                            ))}
                            {commentsByGeneration[generationId]?.length === 0 && (
                                <p className="text-sm text-stone-500 dark:text-stone-400">
                                    No comments yet. Be the first to leave a kind word.
                                </p>
                            )}
                        </div>
                    )}
                    <form
                        className="mt-4 flex gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void handlePostComment(generationId, commentDrafts[generationId] ?? '');
                        }}
                    >
                        <input
                            value={commentDrafts[generationId] ?? ''}
                            onChange={(event) =>
                                setCommentDrafts((previous) => ({
                                    ...previous,
                                    [generationId]: event.target.value,
                                }))
                            }
                            maxLength={500}
                            placeholder="Leave a kind word or advice..."
                            aria-label="Leave a kind word or advice"
                            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                        />
                        <button
                            type="submit"
                            disabled={commentPosting[generationId] || !(commentDrafts[generationId] ?? '').trim()}
                            className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-200 dark:text-stone-900"
                        >
                            {commentPosting[generationId] ? 'Posting...' : 'Post'}
                        </button>
                    </form>
                </div>
            )}
        </section>
    );

    return (
        <main className="min-h-screen bg-gradient-to-b from-[#F2F7F4] via-[#EEF5F1] to-[#E5EFE9] px-4 py-10 text-[#2D3748] sm:px-6 lg:px-8 dark:from-[#101a14] dark:via-[#0d1711] dark:to-[#0a120d] dark:text-stone-100">
            {toastMessage && (
                <div
                    className="fixed left-1/2 top-5 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-rose-400 bg-rose-600 px-6 py-3 text-white shadow-2xl"
                    role="status"
                >
                    <span className="text-xl" aria-hidden="true">⚠️</span>
                    <span className="text-sm font-semibold">{toastMessage}</span>
                </div>
            )}

            <header className="mx-auto mb-10 flex max-w-3xl flex-wrap items-center justify-between gap-4 border-b border-[#DCE9E0] pb-5 dark:border-stone-800">
                <div>
                    <h1 className="font-serif text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
                        Meditations.cc
                    </h1>
                    <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                        Stoic Clarity for Morningside Chaos
                    </p>
                </div>
                <div>
                    {currentUser ? (
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-stone-600 dark:text-stone-400">
                                {currentUser.email}
                            </span>
                            <SignOutButton />
                        </div>
                    ) : (
                        <GoogleSignInButton />
                    )}
                </div>
            </header>

            <section className="mx-auto mb-10 max-w-3xl">
                <form
                    onSubmit={handleGenerate}
                    className="rounded-3xl border border-[#E0EBE3] bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900"
                >
                    <div className="grid gap-5">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                            <div className="min-w-0 flex-1">
                            <label
                                htmlFor="location"
                                className="mb-2 block text-sm font-semibold text-[#2D3748] dark:text-stone-200"
                            >
                                Time &amp; location
                            </label>
                            <input
                                id="location"
                                value={location}
                                onChange={(event) => setLocation(event.target.value)}
                                placeholder="3:30 PM, Butler Library"
                                className="w-full rounded-xl border border-[#DCE8DF] bg-[#F8FBF9] px-4 py-3 text-[#2D3748] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5F937B] dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:ring-emerald-400"
                                disabled={loading}
                                required
                            />
                            </div>
                            <div className="flex min-h-28 flex-1 items-center justify-center gap-3 overflow-hidden rounded-2xl border border-[#E3EEE6] bg-gradient-to-br from-[#F3F8F4] to-[#EAF3ED] px-4 py-3 sm:max-w-[48%] dark:border-stone-700 dark:from-stone-800 dark:to-stone-900">
                                <svg
                                    viewBox="0 0 120 100"
                                    role="img"
                                    aria-label="A relaxed, smiling lion with a blue crown"
                                    className="h-24 w-28 shrink-0 animate-[float_4s_ease-in-out_infinite] text-[#7A573D]"
                                >
                                    <path d="M60 14c-8 0-13 5-16 11-14-3-27 7-28 21-9 9-8 25 1 33 1 10 10 17 21 16 7 5 15 7 22 5 7 2 15 0 22-5 11 1 20-6 21-16 9-8 10-24 1-33-1-14-14-24-28-21-3-6-8-11-16-11Z" fill="#D8A56C" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
                                    <path d="m43 24 3-12 12 8 12-8 7 12" fill="#75AADB" stroke="#477BA9" strokeWidth="2.5" strokeLinejoin="round" />
                                    <circle cx="47" cy="49" r="2.5" fill="#46372D" />
                                    <circle cx="73" cy="49" r="2.5" fill="#46372D" />
                                    <path d="M54 60q6 6 12 0M60 56v4m-11 9q11 8 22 0" fill="none" stroke="#654839" strokeWidth="2.5" strokeLinecap="round" />
                                    <circle cx="39" cy="61" r="4" fill="#E88E7A" opacity=".65" />
                                    <circle cx="81" cy="61" r="4" fill="#E88E7A" opacity=".65" />
                                    <path d="M29 49h-9m10 6-9 3m70-9h9m-10 6 9 3" stroke="#654839" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                                <div className="min-w-0">
                                    <p className="font-serif text-sm font-semibold text-[#365B48] dark:text-emerald-200">
                                        A little calm in the city
                                    </p>
                                    <span className="mt-2 inline-flex rounded-full bg-[#E3F0E8] px-3 py-1 text-xs font-semibold text-[#2D6A4F] dark:bg-emerald-950 dark:text-emerald-200">
                                        <svg viewBox="0 0 24 24" aria-hidden="true" className="mr-1.5 size-4 text-[#75AADB]">
                                            <path d="M4 19h16M6 16V8l3 2 3-5 3 5 3-2v8M8 13h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        Morningside Heights Calm Zone
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label
                                htmlFor="scenario"
                                className="mb-2 block text-sm font-semibold text-[#2D3748] dark:text-stone-200"
                            >
                                Current activity &amp; stress trigger
                            </label>
                    <textarea
                        id="scenario"
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder="Studying for finals, feeling overwhelmed..."
                        rows={4}
                        className="w-full resize-y rounded-xl border border-[#DCE8DF] bg-[#F8FBF9] px-4 py-3 text-[#2D3748] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5F937B] dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:ring-emerald-400"
                        disabled={loading}
                        required
                    />
                        </div>
                    </div>

                    <div className="mt-6 grid gap-6 sm:grid-cols-2">
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label
                                    htmlFor="stress-level"
                                    className="text-sm font-semibold text-[#2D3748] dark:text-stone-200"
                                >
                                    Stress Level
                                </label>
                                <span className="rounded-full bg-[#E8F4EC] px-3 py-1 text-sm font-bold text-[#2D6A4F] dark:bg-emerald-950 dark:text-emerald-200">
                                    {stressLevel}/10
                                </span>
                            </div>
                            <input
                                id="stress-level"
                                type="range"
                                min="1"
                                max="10"
                                value={stressLevel}
                                onChange={(event) => setStressLevel(Number(event.target.value))}
                                className="w-full accent-[#5F937B] dark:accent-emerald-400"
                                disabled={loading}
                            />
                            <p className="mt-2 text-sm font-medium text-stone-600 dark:text-stone-300">
                                {stressLevel <= 3
                                    ? '🌱 1-3 Mild Anxiety'
                                    : stressLevel <= 7
                                        ? '⚡ 4-7 Standard Meltdown'
                                        : '🔥 8-10 Ready to Drop Out'}
                            </p>
                        </div>

                        <fieldset>
                            <legend className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-200">
                                Tone
                            </legend>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTone('gentle')}
                                    aria-pressed={tone === 'gentle'}
                                    disabled={loading}
                                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                                        tone === 'gentle'
                                            ? 'border-[#4E816A] bg-[#4E816A] text-white hover:bg-[#3D6E58] dark:border-emerald-400 dark:bg-emerald-400 dark:text-stone-950'
                                            : 'border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800'
                                    }`}
                                >
                                    🌿 Gentle Stoic
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTone('roast')}
                                    aria-pressed={tone === 'roast'}
                                    disabled={loading}
                                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                                        tone === 'roast'
                                            ? 'border-amber-700 bg-amber-700 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-stone-950'
                                            : 'border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800'
                                    }`}
                                >
                                    🔥 NYC Roaster
                                </button>
                            </div>
                        </fieldset>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !prompt.trim() || !location.trim()}
                        className="mt-6 w-full rounded-xl bg-[#4E816A] px-6 py-3 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#3D6E58] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-400 dark:text-stone-950 dark:hover:bg-emerald-300"
                    >
                        {loading ? 'Reframing...' : 'Find some perspective'}
                    </button>
                </form>
            </section>

            {loading && (
                <section className="mx-auto mb-8 max-w-3xl" aria-label="Generation progress">
                    <StoicLoader />
                </section>
            )}

            {latestReflection && (() => {
                const content = getJournalContent(latestReflection.output_text);
                const quoteSourceMatch = latestReflection.stoic_quote?.match(/^(.*)\s+—\s+(Meditations[\s\S]*)$/);

                return (
                    <section
                        ref={latestReflectionRef}
                        className="mx-auto mb-10 max-w-3xl scroll-mt-8"
                        aria-labelledby="latest-reflection-title"
                    >
                        <h2
                            id="latest-reflection-title"
                            className="mb-5 font-serif text-2xl font-semibold text-stone-800 dark:text-stone-100"
                        >
                            ✨ Your Stoic Prescription &amp; Polaroid
                        </h2>
                        <article className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-lg dark:border-emerald-900 dark:bg-stone-900 sm:p-7">
                            <p className="font-serif text-2xl leading-relaxed text-stone-900 dark:text-stone-100">
                                {content.analysis}
                            </p>
                            {content.actions && (
                                <div className="my-6 grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl bg-stone-50 p-4 dark:bg-stone-950">
                                        <h3 className="mb-2 text-sm font-semibold text-stone-800 dark:text-stone-100">◉ 1-minute reset</h3>
                                        <p className="text-sm text-stone-600 dark:text-stone-300">{content.actions.meditation}</p>
                                    </div>
                                    <div className="rounded-xl bg-stone-50 p-4 dark:bg-stone-950">
                                        <h3 className="mb-2 text-sm font-semibold text-stone-800 dark:text-stone-100">↗ 3-minute walk</h3>
                                        <p className="text-sm text-stone-600 dark:text-stone-300">{content.actions.walk}</p>
                                    </div>
                                    <div className="rounded-xl bg-stone-50 p-4 dark:bg-stone-950">
                                        <h3 className="mb-2 text-sm font-semibold text-stone-800 dark:text-stone-100">✧ Nearby anchor</h3>
                                        <p className="text-sm text-stone-600 dark:text-stone-300">{content.actions.nearby_anchor}</p>
                                    </div>
                                </div>
                            )}
                            <div className="mx-auto mt-7 max-w-md rounded-sm border border-stone-200/80 bg-[#FDFBF7] p-5 pb-8 text-stone-800 shadow-2xl">
                                <div id={`journal-card-latest-${latestReflection.id}`}>
                                    <div className="flex items-start justify-between gap-3 font-serif text-xs text-stone-600">
                                        <div>
                                            <p className="font-semibold text-stone-900">
                                                {content.author_name || currentUser?.user_metadata.full_name || 'Your journal'}
                                            </p>
                                            <p className="mt-1">📍 {content.location || location || 'Morningside'}</p>
                                        </div>
                                        <time dateTime={latestReflection.created_at} className="text-right">
                                            {formatEnglishDate(latestReflection.created_at)}
                                        </time>
                                    </div>
                                    <div className="my-4 overflow-hidden rounded-sm border border-stone-300/70">
                                        <PostImage
                                            key={`${latestReflection.id}:${latestReflection.imageUrl ?? latestReflection.image_url ?? ''}`}
                                            src={
                                                latestReflection.imageUrl ||
                                                latestReflection.image_url ||
                                                content.image_url ||
                                                createPostImageUrl(
                                                    latestReflection.image_prompt || content.image_prompt || latestReflection.prompt,
                                                    latestReflection.id,
                                                    new Date(latestReflection.created_at).getTime(),
                                                )
                                            }
                                            preloaded={latestReflection.imagePreloaded}
                                            alt={latestReflection.stoic_quote || 'Reflection illustration'}
                                        />
                                    </div>
                                    <span className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                                        🔥 Stress: {latestReflection.stress_level ?? stressLevel}/10
                                    </span>
                                    {latestReflection.stoic_quote && (
                                        <blockquote className="border-l-2 border-amber-700/50 pl-3">
                                            <p className="font-serif text-sm italic leading-relaxed text-stone-800">
                                                “{quoteSourceMatch?.[1] ?? latestReflection.stoic_quote}”
                                            </p>
                                            <cite className="mt-2 block text-xs font-semibold not-italic uppercase tracking-[0.12em] text-amber-800">
                                                {quoteSourceMatch?.[2] ?? 'Marcus Aurelius · Meditations'}
                                            </cite>
                                        </blockquote>
                                    )}
                                    <p className="mt-4 font-serif text-sm leading-relaxed text-stone-700">{content.analysis}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        void handleDownloadCard(
                                            latestReflection.id,
                                            `journal-card-latest-${latestReflection.id}`,
                                        )
                                    }
                                    disabled={downloadingCard === latestReflection.id}
                                    className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-wait disabled:opacity-60"
                                >
                                    {downloadingCard === latestReflection.id ? 'Preparing image...' : '📸 Download Polaroid (PNG)'}
                                </button>
                            </div>
                            {renderCommentsSection(latestReflection.id)}
                        </article>
                    </section>
                );
            })()}

            <section className="mx-auto max-w-3xl" aria-labelledby="vent-feed-title">
                <div
                    className="my-10 flex w-full items-center justify-center px-4"
                    aria-hidden="true"
                >
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-200/80 to-emerald-300/60" />
                    <div className="flex select-none items-center gap-2 px-4 text-[#4A6B5D]/70">
                        <svg
                            className="h-5 w-5 -scale-x-100 opacity-80"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12 22C12 22 13 16 9 12C5 8 7 3 7 3C7 3 12 5 13 9C14 13 12 22 12 22Z" fill="currentColor" fillOpacity="0.15" />
                            <path d="M12 22C12 17 17 14 19 9" />
                        </svg>
                        <span className="rounded-full border border-emerald-100 bg-emerald-50/80 px-2 py-0.5 font-serif text-xs font-medium uppercase tracking-widest text-emerald-800/70">
                            🌿 Campus Whispers 🌿
                        </span>
                        <svg
                            className="h-5 w-5 opacity-80"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12 22C12 22 13 16 9 12C5 8 7 3 7 3C7 3 12 5 13 9C14 13 12 22 12 22Z" fill="currentColor" fillOpacity="0.15" />
                            <path d="M12 22C12 17 17 14 19 9" />
                        </svg>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent via-emerald-200/80 to-emerald-300/60" />
                </div>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h2 id="vent-feed-title" className="font-serif text-2xl font-semibold text-stone-800 dark:text-stone-100">
                            Morningside Vent Feed
                        </h2>
                        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                            A little perspective, and a reminder you’re not alone.
                        </p>
                    </div>
                    <div className="flex rounded-xl border border-stone-200 bg-white p-1 dark:border-stone-800 dark:bg-stone-900">
                        <button
                            type="button"
                            onClick={() => setFeedSort('latest')}
                            aria-pressed={feedSort === 'latest'}
                            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                feedSort === 'latest'
                                    ? 'bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900'
                                    : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
                            }`}
                        >
                            🕒 Latest
                        </button>
                        <button
                            type="button"
                            onClick={() => setFeedSort('highest-stress')}
                            aria-pressed={feedSort === 'highest-stress'}
                            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                feedSort === 'highest-stress'
                                    ? 'bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900'
                                    : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
                            }`}
                        >
                            🌋 Most Stressed
                        </button>
                    </div>
                </div>

                {feedError && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                        <p>{feedError}</p>
                        <button
                            type="button"
                            onClick={() => void fetchGenerations()}
                            className="mt-3 text-sm font-semibold underline"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {feedLoading ? (
                    <div className="space-y-4" aria-label="Loading vent feed">
                        {[0, 1, 2].map((skeleton) => (
                            <div
                                key={skeleton}
                                className="animate-pulse rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900"
                            >
                                <div className="mb-4 h-4 w-28 rounded bg-stone-200 dark:bg-stone-700" />
                                <div className="mb-3 h-5 w-4/5 rounded bg-stone-200 dark:bg-stone-700" />
                                <div className="h-4 w-2/3 rounded bg-stone-200 dark:bg-stone-700" />
                                <div className="mt-6 h-10 w-48 rounded-xl bg-stone-200 dark:bg-stone-700" />
                            </div>
                        ))}
                    </div>
                ) : !feedError && generations.length === 0 ? (
                    <p className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center text-stone-500 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
                        No vents yet. Share what’s on your mind above.
                    </p>
                ) : (
                    <div className="space-y-5">
                        {generations.map((post) => {
                            const item = post;
                            const content = getJournalContent(item.output_text);
                            const quoteSourceMatch = item.stoic_quote?.match(/^(.*)\s+—\s+(Meditations[\s\S]*)$/);
                            const quoteText = quoteSourceMatch?.[1] ?? item.stoic_quote;
                            const quoteSource = quoteSourceMatch?.[2] ?? 'Marcus Aurelius · Meditations';
                            const journalLocation = content.location || 'Morningside';
                            const reactedHug = generationCardContent(item.id, 'hug');
                            const reactedSameHere = generationCardContent(item.id, 'same_here');
                            const hugCount = Math.max(item.hug_count ?? 0, reactionCounts[item.id]?.hug ?? 0);
                            const sameHereCount = Math.max(
                                item.same_here_count ?? 0,
                                reactionCounts[item.id]?.same_here ?? 0,
                            );
                            const hugStorageKey = `meditations-reaction:${currentUser?.id ?? 'anonymous'}:${item.id}:hug`;
                            const sameHereStorageKey = `meditations-reaction:${currentUser?.id ?? 'anonymous'}:${item.id}:same_here`;

                            return (
                                <article
                                    key={item.id}
                                    className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-stone-800 dark:bg-stone-900 sm:p-6"
                                >
                                    <div className="mb-4 flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                                            Anonymous · Morningside student
                                        </span>
                                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                                            📍 {journalLocation}
                                        </span>
                                        {item.stress_level != null && (
                                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                                ⚡ Stress: {item.stress_level}/10
                                            </span>
                                        )}
                                    </div>

                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                                        A student’s vent
                                    </p>
                                    <p className="mb-4 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                                        {item.prompt.length > 180 ? `${item.prompt.slice(0, 180).trimEnd()}…` : item.prompt}
                                    </p>
                                    <p className="whitespace-pre-wrap font-serif text-xl leading-relaxed text-stone-900 dark:text-stone-100">
                                        {content.analysis}
                                    </p>

                                    {content.actions && (
                                        <div className="my-5 grid gap-3 sm:grid-cols-3">
                                            <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-950">
                                                <h3 className="mb-1 text-xs font-semibold text-stone-800 dark:text-stone-100">◉ 1-minute reset</h3>
                                                <p className="text-sm text-stone-600 dark:text-stone-300">{content.actions.meditation}</p>
                                            </div>
                                            <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-950">
                                                <h3 className="mb-1 text-xs font-semibold text-stone-800 dark:text-stone-100">↗ 3-minute walk</h3>
                                                <p className="text-sm text-stone-600 dark:text-stone-300">{content.actions.walk}</p>
                                            </div>
                                            <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-950">
                                                <h3 className="mb-1 text-xs font-semibold text-stone-800 dark:text-stone-100">✧ Nearby anchor</h3>
                                                <p className="text-sm text-stone-600 dark:text-stone-300">{content.actions.nearby_anchor}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mx-auto my-6 max-w-md rounded-sm border border-stone-200/80 bg-[#FDFBF7] p-5 pb-8 text-stone-800 shadow-2xl">
                                        <div id={`journal-card-${item.id}`}>
                                            <div className="flex items-start justify-between gap-3 font-serif text-xs text-stone-600">
                                                <div>
                                                    <p className="font-semibold text-stone-900">Anonymous</p>
                                                    <p className="mt-1">📍 {journalLocation}</p>
                                                </div>
                                                <time dateTime={item.created_at} className="text-right">
                                                    {formatEnglishDate(item.created_at)}
                                                </time>
                                            </div>
                                            <div className="my-4 overflow-hidden rounded-sm border border-stone-300/70">
                                                <PostImage
                                                    key={`${post.id}:${post.imageUrl}`}
                                                    src={post.imageUrl}
                                                    preloaded={post.imagePreloaded}
                                                    alt={post.stoic_quote || 'Reflection illustration'}
                                                />
                                            </div>
                                            <div className="mb-3 flex flex-wrap gap-2">
                                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                                                    🔥 Stress: {item.stress_level ?? '—'}/10
                                                </span>
                                            </div>
                                            {item.stoic_quote && (
                                                <blockquote className="border-l-2 border-amber-700/50 pl-3">
                                                    <p className="font-serif text-sm italic leading-relaxed text-stone-800">
                                                        “{quoteText}”
                                                    </p>
                                                    <cite className="mt-2 block text-xs font-semibold not-italic uppercase tracking-[0.12em] text-amber-800">
                                                        {quoteSource}
                                                    </cite>
                                                </blockquote>
                                            )}
                                            <p className="mt-4 font-serif text-sm leading-relaxed text-stone-700">{content.analysis}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleDownloadCard(item.id)}
                                            disabled={downloadingCard === item.id}
                                            className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-wait disabled:opacity-60"
                                        >
                                            {downloadingCard === item.id ? 'Preparing image...' : '📸 Download Polaroid (PNG)'}
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4 dark:border-stone-800">
                                        <time dateTime={item.created_at} className="text-xs text-stone-500 dark:text-stone-400">
                                            {formatEnglishDate(item.created_at)}
                                        </time>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void handleReaction(item.id, 'hug')}
                                                disabled={pendingReactions[hugStorageKey] || reactedHug}
                                                aria-pressed={reactedHug}
                                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                                            >
                                                🤗 Hug (+1) · {hugCount}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleReaction(item.id, 'same_here')}
                                                disabled={pendingReactions[sameHereStorageKey] || reactedSameHere}
                                                aria-pressed={reactedSameHere}
                                                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200"
                                            >
                                                🤝 Same Here (+1) · {sameHereCount}
                                            </button>
                                        </div>
                                    </div>
                                    {renderCommentsSection(item.id)}
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}
