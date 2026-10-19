import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { HiMicrophone } from 'react-icons/hi';

export default function AudioTranscription() {
    const [transcript, setTranscript] = useState('');
    const [fileName, setFileName] = useState('');

    const mutation = useMutation({
        mutationFn: (file) => {
            const formData = new FormData();
            formData.append('audio', file);
            return api.post('/audio/transcribe', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        },
        onSuccess: (res) => setTranscript(res.data.transcript),
    });

    const handleUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            setTranscript('');
            mutation.mutate(file);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-xl font-bold text-gray-900">Audio Transcription</h1>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:border-indigo-400 transition-colors">
                    <HiMicrophone className="w-8 h-8 text-gray-400" aria-hidden="true" />
                    <span className="text-sm text-gray-500">
                        {mutation.isPending ? 'Transcribing...' : 'Upload an audio file (MP3, WAV, M4A, WebM, OGG)'}
                    </span>
                    {fileName && <span className="text-xs text-gray-400">{fileName}</span>}
                    <input type="file" className="hidden" accept=".mp3,.wav,.m4a,.webm,.ogg" onChange={handleUpload} disabled={mutation.isPending} />
                </label>
                {mutation.isError && <p className="text-red-600 text-sm mt-3">Transcription failed. Please try again.</p>}
            </div>

            {transcript && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h2 className="font-medium text-gray-900 mb-3">Transcription</h2>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{transcript}</p>
                </div>
            )}
        </div>
    );
}
