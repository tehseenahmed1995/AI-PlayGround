import React, { useState } from 'react';
import { HiSearch } from 'react-icons/hi';

export default function Research() {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!question.trim() || loading) return;

        setAnswer('');
        setLoading(true);

        try {
            const response = await fetch('/api/research', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ question }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let result = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                result += decoder.decode(value, { stream: true });
                setAnswer(result);
            }
        } catch {
            setAnswer('Research failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-xl font-bold text-gray-900">Research Agent</h1>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="research-q" className="block text-sm font-medium text-gray-700 mb-1">Research Question</label>
                        <textarea id="research-q" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Ask a research question... The agent will search the web and summarize findings."
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm resize-none" />
                    </div>

                    <button type="submit" disabled={loading || !question.trim()}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        <HiSearch className="w-4 h-4" aria-hidden="true" />
                        {loading ? 'Researching...' : 'Research'}
                    </button>
                </form>
            </div>

            {answer && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h2 className="font-medium text-gray-900 mb-3">Findings</h2>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{answer}</div>
                </div>
            )}
        </div>
    );
}
