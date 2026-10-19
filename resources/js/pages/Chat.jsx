import React, { useState, useRef, useEffect } from 'react';
import api from '../lib/api';
import { HiPaperAirplane } from 'react-icons/hi';

export default function Chat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    message: userMessage,
                    conversation_id: conversationId,
                }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';

            setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                assistantMessage += chunk;

                setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
                    return updated;
                });
            }
        } catch (err) {
            setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-7rem)]">
            <h1 className="text-xl font-bold text-gray-900 mb-4">AI Chatbot</h1>

            <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-400 mt-20">
                            <p className="text-lg">Start a conversation</p>
                            <p className="text-sm mt-1">Ask anything about programming or Laravel.</p>
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                                msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-br-md'
                                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                            }`}>
                                {msg.content || <span className="animate-pulse">Thinking...</span>}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={sendMessage} className="border-t border-gray-200 p-3 flex gap-2">
                    <label htmlFor="chat-input" className="sr-only">Message</label>
                    <input
                        id="chat-input"
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        disabled={loading}
                    />
                    <button type="submit" disabled={loading || !input.trim()}
                        className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        aria-label="Send message">
                        <HiPaperAirplane className="w-4 h-4 rotate-90" aria-hidden="true" />
                    </button>
                </form>
            </div>
        </div>
    );
}
