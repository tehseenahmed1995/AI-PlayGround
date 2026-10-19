import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Documents from './pages/Documents';
import ImageGenerator from './pages/ImageGenerator';
import AudioTranscription from './pages/AudioTranscription';
import Summarizer from './pages/Summarizer';
import Research from './pages/Research';

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
    return user ? children : <Navigate to="/login" />;
}

export default function AppRouter() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="chat" element={<Chat />} />
                <Route path="documents" element={<Documents />} />
                <Route path="images" element={<ImageGenerator />} />
                <Route path="audio" element={<AudioTranscription />} />
                <Route path="summarizer" element={<Summarizer />} />
                <Route path="research" element={<Research />} />
            </Route>
        </Routes>
    );
}
