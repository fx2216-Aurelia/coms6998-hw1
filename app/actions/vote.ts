'use server';

import { createClient } from '@/lib/server';

export async function castVote(generationId: string, voteType: 1 | -1) {
    const supabase = await createClient();

    // 1. 服务端验证登录状态
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
        return { error: 'Please sign in to vote' };
    }

    // 2. 查询当前用户是否已对该卡片投票
    const { data: existingVote, error: fetchError } = await supabase
        .from('votes')
        .select('*')
        .eq('generation_id', generationId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (fetchError) {
        return { error: fetchError.message };
    }

    // 3. 执行要求中的投票业务规则
    if (existingVote) {
        if (existingVote.vote_type === voteType) {
            // 规则一：点击同一种票 -> DELETE (取消投票)
            const { error: deleteError } = await supabase
                .from('votes')
                .delete()
                .eq('id', existingVote.id);

            if (deleteError) return { error: deleteError.message };
            return { success: true, action: 'unvoted' };
        } else {
            // 规则二：点击相反的票 -> UPDATE (切换投票类型)
            const { error: updateError } = await supabase
                .from('votes')
                .update({ vote_type: voteType })
                .eq('id', existingVote.id);

            if (updateError) return { error: updateError.message };
            return { success: true, action: 'toggled' };
        }
    } else {
        // 规则三：无历史投票 -> INSERT 新投票记录
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