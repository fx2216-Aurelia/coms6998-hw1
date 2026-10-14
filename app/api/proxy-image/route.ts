import { createClient } from '@/lib/server';

const ALLOWED_HOSTS = new Set(['image.pollinations.ai', 'images.unsplash.com']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function isAllowedImageUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return (
            url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            (url.port === '' || url.port === '443') &&
            ALLOWED_HOSTS.has(url.hostname)
        );
    } catch {
        return false;
    }
}

export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const requestUrl = new URL(request.url);
    let targetUrl = requestUrl.searchParams.get('url');
    if (!targetUrl || !isAllowedImageUrl(targetUrl)) {
        return new Response('Unsupported image URL', { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
        let upstream: Response | undefined;
        for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
            upstream = await fetch(targetUrl, {
                cache: 'no-store',
                redirect: 'manual',
                signal: controller.signal,
                headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8' },
            });

            if (![301, 302, 303, 307, 308].includes(upstream.status)) break;

            const location = upstream.headers.get('location');
            if (!location || redirects === MAX_REDIRECTS) {
                return new Response('Image redirect could not be followed', { status: 502 });
            }
            targetUrl = new URL(location, targetUrl).toString();
            if (!isAllowedImageUrl(targetUrl)) {
                return new Response('Image redirect destination is not allowed', { status: 502 });
            }
        }

        if (!upstream?.ok) {
            return new Response('Image provider request failed', { status: 502 });
        }

        const contentType = upstream.headers.get('content-type')?.split(';', 1)[0].trim() ?? '';
        if (!['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
            return new Response('Image provider returned a non-image response', { status: 502 });
        }

        const declaredLength = Number(upstream.headers.get('content-length'));
        if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
            return new Response('Image is too large', { status: 413 });
        }

        const image = await upstream.arrayBuffer();
        if (image.byteLength > MAX_IMAGE_BYTES) {
            return new Response('Image is too large', { status: 413 });
        }

        return new Response(image, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(image.byteLength),
                'Cache-Control': 'private, max-age=300',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        console.error('Image proxy request failed:', error);
        return new Response('Could not retrieve image', { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
