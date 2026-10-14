'use server';

import { createClient } from '@/lib/server';

export async function castVote(generationId: string, voteType: 1 | -1) {
    const supabase = await createClient();

    // Verify the signed-in user.
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
        return { error: 'Please sign in to vote' };
    }

    // Check whether this user already voted on this generation.
    const { data: existingVote, error: fetchError } = await supabase
        .from('votes')
        .select('*')
        .eq('generation_id', generationId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (fetchError) {
        return { error: fetchError.message };
    }

    // Apply the voting rules.
    if (existingVote) {
        if (existingVote.vote_type === voteType) {
            // Clicking the same vote removes it.
            const { error: deleteError } = await supabase
                .from('votes')
                .delete()
                .eq('id', existingVote.id);

            if (deleteError) return { error: deleteError.message };
            return { success: true, action: 'unvoted' };
        } else {
            // Clicking the opposite vote changes the vote type.
            const { error: updateError } = await supabase
                .from('votes')
                .update({ vote_type: voteType })
                .eq('id', existingVote.id);

            if (updateError) return { error: updateError.message };
            return { success: true, action: 'toggled' };
        }
    } else {
        // Insert a vote when none exists yet.
        const { error: insertError } = await supabase
            .from('votes')
            .insert({
                generation_id: generationId,
                user_id: user.id,
                vote_type: voteType,
            });

        if (insertError) return { error: insertError.message };
        return { success: true, action: 'inserted' };
    }
}