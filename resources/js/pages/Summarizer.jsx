import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';

export default function Summarizer() {
    const [text, setText] = useState('');
    const [summary, setSummary] = useState('');

    const mutation = useMutation({
        mutationFn: (text) => api.post('/summarize', { text }).then((r) => r.data),
        onSuccess: (data) => setSummary(data.summary),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (text.trim()) mutation.mutate(text);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-xl font-bold text-gray-900">AI Summarizer</h1>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="summarize-text" className="block text-sm font-medium text-gray-700 mb-1">Text to Summarize</label>
                        <textarea id="summarize-text" rows={10} value={text} onChange={(e) => setText(e.target.value)}
                            placeholder="Paste the text you want to summarize..."
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm resize-none" />
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{text.length} characters</span>
                        <button type="submit" disabled={mutation.isPending || !text.trim()}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                            {mutation.isPending ? 'Summarizing...' : 'Summarize'}
                        </button>
                    </div>
                </form>
            </div>

            {summary && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h2 className="font-medium text-gray-900 mb-3">Summary</h2>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{summary}</p>
                </div>
            )}
        </div>
    );
}
