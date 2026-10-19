import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';

export default function ImageGenerator() {
    const [prompt, setPrompt] = useState('');
    const [size, setSize] = useState('square');
    const [generatedImage, setGeneratedImage] = useState(null);

    const mutation = useMutation({
        mutationFn: (data) => api.post('/image/generate', data).then((r) => r.data),
        onSuccess: (data) => setGeneratedImage(data),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (prompt.trim()) mutation.mutate({ prompt, size });
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-xl font-bold text-gray-900">Image Generation</h1>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="img-prompt" className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                        <textarea id="img-prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the image you want to generate..."
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm resize-none" />
                    </div>

                    <div>
                        <label htmlFor="img-size" className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                        <select id="img-size" value={size} onChange={(e) => setSize(e.target.value)}
                            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm">
                            <option value="square">Square</option>
                            <option value="landscape">Landscape</option>
                            <option value="portrait">Portrait</option>
                        </select>
                    </div>

                    <button type="submit" disabled={mutation.isPending || !prompt.trim()}
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {mutation.isPending ? 'Generating...' : 'Generate Image'}
                    </button>
                </form>

                {mutation.isError && <p className="text-red-600 text-sm mt-3">Generation failed. Please try again.</p>}
            </div>

            {generatedImage && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h2 className="font-medium text-gray-900 mb-3">Generated Image</h2>
                    <img src={generatedImage.url} alt={`AI generated: ${prompt}`} className="rounded-lg max-w-full" />
                </div>
            )}
        </div>
    );
}
