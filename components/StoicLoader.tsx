'use client';

import { useEffect, useState } from 'react';

type Illustration = 'sanctuary' | 'present' | 'roots' | 'candle' | 'water' | 'tree' | 'sunrise';

const stoicQuotes = [
    {
        text: 'Nowhere can man find a quieter or more untroubled retreat than in his own soul.',
        source: 'Meditations, 4.3',
        context: 'Find stillness within.',
        illustration: 'sanctuary',
    },
    {
        text: 'Confine yourself to the present.',
        source: 'Meditations, 8.36',
        context: 'Return to this moment.',
        illustration: 'present',
    },
    {
        text: 'Very little is needed to make a happy life; it is all within yourself, in your way of thinking.',
        source: 'Meditations, 7.67',
        context: 'Your perspective is yours to shape.',
        illustration: 'roots',
    },
    {
        text: 'Do not act as if you had ten thousand years to throw away.',
        source: 'Meditations, 4.17',
        context: 'Give this moment your attention.',
        illustration: 'candle',
    },
    {
        text: 'Loss is nothing else but change, and change is Nature’s delight.',
        source: 'Meditations, 12.23',
        context: 'Let change move through you.',
        illustration: 'water',
    },
    {
        text: 'Accept the things to which fate binds you, and love the people with whom fate brings you together.',
        source: 'Meditations, 6.39',
        context: 'Meet what comes with an open heart.',
        illustration: 'tree',
    },
    {
        text: 'When you arise in the morning, think of what a precious privilege it is to be alive.',
        source: 'Meditations, 5.1',
        context: 'Begin with gratitude.',
        illustration: 'sunrise',
    },
] satisfies { text: string; source: string; context: string; illustration: Illustration }[];

export default function StoicLoader() {
    const [quoteIndex, setQuoteIndex] = useState<number | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const initialIndex = Math.floor(Math.random() * stoicQuotes.length);
        const initialTimeout = setTimeout(() => {
            setQuoteIndex(initialIndex);
            setIsVisible(true);
        }, 0);
        let transitionTimeout: ReturnType<typeof setTimeout> | undefined;
        const cycleInterval = setInterval(() => {
            setIsVisible(false);
            transitionTimeout = setTimeout(() => {
                setQuoteIndex((currentIndex) =>
                    currentIndex === null ? initialIndex : (currentIndex + 1) % stoicQuotes.length,
                );
                setIsVisible(true);
            }, 1000);
        }, 8500);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(cycleInterval);
            if (transitionTimeout) clearTimeout(transitionTimeout);
        };
    }, []);

    useEffect(() => {
        const startedAt = Date.now();
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startedAt;
            let nextProgress: number;

            if (elapsed <= 1500) {
                const progressThroughStage = elapsed / 1500;
                nextProgress = 40 * (1 - (1 - progressThroughStage) ** 3);
            } else if (elapsed <= 5500) {
                nextProgress = 40 + ((elapsed - 1500) / 4000) * 40;
            } else {
                nextProgress = 95 - 15 * Math.exp(-(elapsed - 5500) / 12000);
            }

            setProgress(Math.min(95, nextProgress));
        }, 100);

        return () => clearInterval(progressInterval);
    }, []);

    const quote = quoteIndex === null ? null : stoicQuotes[quoteIndex];
    const illustration = quote?.illustration;

    return (
        <div
            className="flex min-h-80 flex-col items-center justify-center gap-5 rounded-2xl border border-stone-200 bg-stone-50 px-6 py-8 text-center text-stone-800 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            role="status"
            aria-live="polite"
        >
            <div
                aria-hidden="true"
                className="relative flex size-12 items-center justify-center"
            >
                <span className="absolute size-12 animate-pulse rounded-full bg-emerald-500/15 dark:bg-emerald-300/15" />
                <span className="size-3 rounded-full bg-emerald-700 dark:bg-emerald-300" />
            </div>

            <div
                className={`flex min-h-52 max-w-xl flex-col items-center justify-center transition-opacity duration-1000 ease-in-out ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                }`}
            >
                {quote && (
                    <>
                        <svg
                            viewBox="0 0 120 100"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="mb-4 h-24 w-28 animate-pulse text-stone-500 dark:text-stone-400"
                        >
                            {illustration === 'sanctuary' && (
                                <>
                                    <path d="M22 82V48a38 38 0 0 1 76 0v34M34 82V50a26 26 0 0 1 52 0v32M14 82h92M48 82V60a12 12 0 0 1 24 0v22" />
                                    <path d="M60 12v9M39 25l5 7M81 25l-5 7" />
                                </>
                            )}
                            {illustration === 'present' && (
                                <>
                                    <circle cx="60" cy="42" r="15" />
                                    <path d="M18 75h84M28 75a32 32 0 0 1 64 0M60 12v7M26 30l7 4M94 30l-7 4" />
                                </>
                            )}
                            {illustration === 'roots' && (
                                <>
                                    <path d="M60 55V23M60 36C44 34 35 25 34 15c16 0 26 7 26 21ZM60 44c15-2 24-11 25-21-15 0-25 7-25 21ZM60 55c-3 14-14 17-18 29m18-29c3 14 14 17 18 29M60 57v28M29 86h62" />
                                </>
                            )}
                            {illustration === 'candle' && (
                                <>
                                    <path d="M60 15c-9 12-12 19-7 26 2 3 5 4 7 4 9 0 13-10 7-18-1 6-4 7-5 8 1-7-2-13-2-20Z" />
                                    <path d="M45 47h30l5 38H40l5-38ZM52 47v-5m16 5v-5M34 86h52" />
                                </>
                            )}
                            {illustration === 'water' && (
                                <>
                                    <path d="M15 37c12-12 24 12 36 0s24 12 36 0 12-3 18 0M15 55c12-12 24 12 36 0s24 12 36 0 12-3 18 0M15 73c12-12 24 12 36 0s24 12 36 0 12-3 18 0" />
                                    <path d="M60 13c-8 10-12 15-12 21a12 12 0 0 0 24 0c0-6-4-11-12-21Z" />
                                </>
                            )}
                            {illustration === 'tree' && (
                                <>
                                    <path d="M60 50v35M60 62 45 49m15 24 16-16M42 28a18 18 0 0 1 35-5 14 14 0 0 1 1 28H42a12 12 0 0 1 0-23ZM45 85h30" />
                                    <path d="M60 85c-2 5-8 6-12 8m12-8c2 5 8 6 12 8" />
                                </>
                            )}
                            {illustration === 'sunrise' && (
                                <>
                                    <path d="M16 76h88M28 76a32 32 0 0 1 64 0M60 13v12M27 28l8 8m50-8-8 8M13 52h13m68 0h13" />
                                    <path d="M40 61a20 20 0 0 1 40 0" />
                                </>
                            )}
                        </svg>
                        <blockquote className="font-serif text-lg leading-relaxed text-stone-800 sm:text-xl dark:text-stone-100">
                            “{quote.text}”
                        </blockquote>
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                            {quote.source}
                        </p>
                        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
                            {quote.context}
                        </p>
                    </>
                )}
            </div>

            <div
                className="w-full max-w-xs"
                role="group"
                aria-label="Generation progress"
            >
                <div
                    className="h-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
                    role="progressbar"
                    aria-label="Overall generation progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                >
                    <div
                        className="h-full rounded-full bg-stone-500 transition-[width] duration-150 ease-linear dark:bg-stone-400"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <p className="mx-auto mt-2 text-center text-xs tabular-nums text-stone-500 dark:text-stone-400">
                    {Math.round(progress)}%
                </p>
            </div>

            <p className="text-sm text-stone-600 dark:text-stone-300">
                Consulting Marcus Aurelius &amp; reframing your perspective...
            </p>
        </div>
    );
}
