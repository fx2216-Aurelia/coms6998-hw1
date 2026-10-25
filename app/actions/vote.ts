'use server';

import { createClient } from '@/lib/server';

type VoteType = 'hug' | 'coffee';
type VoteError = {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
};

function formatVoteError(error: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
}): VoteError {
    return {
        message: error.message,
        ...(error.code ? { code: error.code } : {}),
        ...(error.details ? { details: error.details } : {}),
        ...(error.hint ? { hint: error.hint } : {}),
    };
}

export async function castVote(generationId: string, voteType: VoteType) {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
        return {
            success: false as const,
            error: { message: authError?.message ?? 'Please sign in to vote' },
        };
    }

    const { data: existingVote, error: fetchError } = await supabase
        .from('votes')
        .select('generation_id')
        .eq('generation_id', generationId)
        .eq('user_id', user.id)
        .eq('vote_type', voteType)
        .maybeSingle();

    if (fetchError) {
        return { success: false as const, error: formatVoteError(fetchError) };
    }

    if (existingVote) {
        const { error: deleteError } = await supabase
            .from('votes')
            .delete()
            .eq('generation_id', generationId)
            .eq('user_id', user.id)
            .eq('vote_type', voteType);

        if (deleteError) return { success: false as const, error: formatVoteError(deleteError) };
        return { success: true, action: 'removed' as const };
    }

    const { error: insertError } = await supabase
        .from('votes')
        .insert({
            generation_id: generationId,
            user_id: user.id,
            vote_type: voteType,
        });

    if (insertError) return { success: false as const, error: formatVoteError(insertError) };
    return { success: true, action: 'added' as const };
}