import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/server';

export async function POST(req: Request) {
    try {
        // 1. 服务端验证登录状态
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized: Please log in first.' }, { status: 401 });
        }

        // 2. 解析请求体
        const { prompt } = await req.json();
        if (!prompt || typeof prompt !== 'string') {
            return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
        }

        // 3. 调用 Gemini AI 生成内容（带自动备用切换）
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing GEMINI_API_KEY environment variable.' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const personaPrompt = `You are Sam, a sharp, witty, and slightly sarcastic college student/young professional. Write a punchy roast or witty observation about this topic: "${prompt}". Keep it funny, relatable, and under 3 sentences.`;

        let outputText = '';
        const candidateModels = ['gemini-3.8-flash', 'gemini-1.5-flash-8b', 'gemini-pro'];

        for (const modelName of candidateModels) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(personaPrompt);
                outputText = result.response.text();
                if (outputText) break;
            } catch (err: any) {
                console.warn(`Model ${modelName} failed, trying next candidate...`, err?.message);
            }
        }

        if (!outputText) {
            throw new Error('All AI models are currently busy. Please wait a few seconds and try again.');
        }

        // 4. 将生成结果持久化存入 Supabase generations 表
        const { data: newGeneration, error: dbError } = await supabase
            .from('generations')
            .insert({
                user_id: user.id,
                prompt: prompt,
                output_text: outputText,
            })
            .select()
            .single();

        if (dbError) {
            console.error('Supabase insert error:', dbError);
            return NextResponse.json({ error: dbError.message }, { status: 500 });
        }

        return NextResponse.json(newGeneration);
    } catch (error: any) {
        console.error('Error generating AI content:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}