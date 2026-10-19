import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { HiUpload, HiSearch } from 'react-icons/hi';

export default function Documents() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);

    const { data: documents } = useQuery({
        queryKey: ['documents'],
        queryFn: () => api.get('/documents').then((r) => r.data.documents),
    });

    const uploadMutation = useMutation({
        mutationFn: (file) => {
            const formData = new FormData();
            formData.append('file', file);
            return api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
    });

    const searchMutation = useMutation({
        mutationFn: (query) => api.post('/documents/search', { query }).then((r) => r.data.results),
        onSuccess: (data) => setSearchResults(data),
    });

    const handleUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) uploadMutation.mutate(file);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) searchMutation.mutate(searchQuery);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-xl font-bold text-gray-900">Document Search (RAG)</h1>

            {/* Upload */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-medium text-gray-900 mb-3">Upload Document</h2>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-indigo-400 transition-colors">
                    <HiUpload className="w-5 h-5 text-gray-400" aria-hidden="true" />
                    <span className="text-sm text-gray-500">
                        {uploadMutation.isPending ? 'Processing...' : 'Click to upload PDF, TXT, MD, or CSV'}
                    </span>
                    <input type="file" className="hidden" accept=".pdf,.txt,.md,.csv" onChange={handleUpload} disabled={uploadMutation.isPending} />
                </label>
                {uploadMutation.isSuccess && <p className="text-green-600 text-sm mt-2">Document uploaded and indexed.</p>}
                {uploadMutation.isError && <p className="text-red-600 text-sm mt-2">Upload failed. Please try again.</p>}
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-medium text-gray-900 mb-3">Semantic Search</h2>
                <form onSubmit={handleSearch} className="flex gap-2">
                    <label htmlFor="doc-search" className="sr-only">Search documents</label>
                    <input id="doc-search" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search your documents..." className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm" />
                    <button type="submit" disabled={searchMutation.isPending}
                        className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors" aria-label="Search">
                        <HiSearch className="w-4 h-4" aria-hidden="true" />
                    </button>
                </form>

                {searchResults && (
                    <div className="mt-4 space-y-3">
                        {searchResults.length === 0 ? (
                            <p className="text-gray-500 text-sm">No matching documents found.</p>
                        ) : (
                            searchResults.map((doc, i) => (
                                <div key={i} className="border border-gray-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-sm text-gray-900">{doc.title}</span>
                                        <span className="text-xs text-gray-400">Chunk #{doc.chunk_index}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 line-clamp-3">{doc.content}</p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Document list */}
            {documents?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h2 className="font-medium text-gray-900 mb-3">Uploaded Documents</h2>
                    <div className="space-y-2">
                        {documents.map((doc, i) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                                    <p className="text-xs text-gray-400">{doc.chunks} chunks · {doc.filename}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
