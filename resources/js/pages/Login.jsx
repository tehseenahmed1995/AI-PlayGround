import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(form.email, form.password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-white font-bold text-lg">AI</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">AI Playground</h1>
                    <p className="text-gray-500 mt-1">Sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                    {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm" role="alert">{error}</div>}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input id="password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>

                    <button type="submit" disabled={loading}
                        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>

                    <p className="text-center text-sm text-gray-500">
                        Don't have an account? <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">Register</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
