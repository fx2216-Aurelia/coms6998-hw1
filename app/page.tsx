import { supabase } from '../lib/supabaseClient';

// 强制动态渲染，确保每次刷新页面都会向 Supabase 请求最新数据
export const dynamic = 'force-dynamic';

// 定义数据类型 (TypeScript 规范)
interface Todo {
    id: number;
    title: string;
    description: string | null;
    created_at?: string;
}

export default async function Home() {
    // === Step 3: Fetch rows from 'todos' table ===
    const { data: todos, error } = await supabase
        .from('todos')
        .select('*');

    // 如果读取失败，展示错误信息
    if (error) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
                <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg max-w-lg">
                    <h1 className="text-xl font-bold mb-2">Error loading from Supabase:</h1>
                    <p className="text-sm">{error.message}</p>
                    <p className="text-xs mt-3 text-red-500">提示：如果提示 permission 错误，请去 Supabase 确认 RLS 策略是否开放了 read/SELECT 权限。</p>
                </div>
            </main>
        );
    }

    // === Step 4: Render a list / card format page ===
    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                {/* 页面标题 */}
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Task List</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Assignment 2: Next.js + Supabase Database Integration
                    </p>
                </div>

                {/* 列表渲染区域 */}
                {(!todos || todos.length === 0) ? (
                    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center text-gray-500">
                        No tasks found. Please insert some rows into your Supabase &apos;todos&apos; table!
                    </div>
                ) : (
                    <div className="space-y-4">
                        {todos.map((todo: Todo) => (
                            <div
                                key={todo.id}
                                className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-gray-800">{todo.title}</h2>
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    ID: #{todo.id}
                  </span>
                                </div>
                                {todo.description && (
                                    <p className="mt-2 text-gray-600 text-sm leading-relaxed">
                                        {todo.description}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}