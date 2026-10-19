import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HiChat, HiDocument, HiPhotograph, HiMicrophone, HiDocumentText, HiSearch } from 'react-icons/hi';

const features = [
    { to: '/chat', icon: HiChat, title: 'AI Chatbot', desc: 'Chat with an AI assistant about programming and Laravel.', color: 'bg-blue-500' },
    { to: '/documents', icon: HiDocument, title: 'Document Search', desc: 'Upload documents and search with semantic embeddings.', color: 'bg-green-500' },
    { to: '/images', icon: HiPhotograph, title: 'Image Generation', desc: 'Generate images from text prompts using AI.', color: 'bg-purple-500' },
    { to: '/audio', icon: HiMicrophone, title: 'Audio Transcription', desc: 'Transcribe audio files to text using speech-to-text.', color: 'bg-red-500' },
    { to: '/summarizer', icon: HiDocumentText, title: 'Summarizer', desc: 'Summarize long text into concise key points.', color: 'bg-amber-500' },
    { to: '/research', icon: HiSearch, title: 'Research Agent', desc: 'AI agent with web search and summarization tools.', color: 'bg-teal-500' },
];

export default function Dashboard() {
    const { user } = useAuth();

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name}</h1>
                <p className="text-gray-500 mt-1">Explore the Laravel AI SDK capabilities below.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {features.map(({ to, icon: Icon, title, desc, color }) => (
                    <Link key={to} to={to} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group">
                        <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center mb-3`}>
                            <Icon className="w-5 h-5 text-white" aria-hidden="true" />
                        </div>
                        <h2 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{title}</h2>
                        <p className="text-sm text-gray-500 mt-1">{desc}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
