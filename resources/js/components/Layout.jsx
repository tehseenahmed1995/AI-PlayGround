import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HiChat, HiDocument, HiPhotograph, HiMicrophone, HiDocumentText, HiSearch, HiHome, HiLogout, HiMenu, HiX } from 'react-icons/hi';

const navItems = [
    { to: '/', icon: HiHome, label: 'Dashboard', end: true },
    { to: '/chat', icon: HiChat, label: 'Chat' },
    { to: '/documents', icon: HiDocument, label: 'Documents' },
    { to: '/images', icon: HiPhotograph, label: 'Images' },
    { to: '/audio', icon: HiMicrophone, label: 'Audio' },
    { to: '/summarizer', icon: HiDocumentText, label: 'Summarizer' },
    { to: '/research', icon: HiSearch, label: 'Research' },
];

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const linkClass = ({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`;

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Mobile overlay */}
            {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-200">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">AI</span>
                    </div>
                    <span className="font-semibold text-gray-900">AI Playground</span>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
                    {navItems.map(({ to, icon: Icon, label, end }) => (
                        <NavLink key={to} to={to} end={end} className={linkClass} onClick={() => setSidebarOpen(false)}>
                            <Icon className="w-5 h-5" aria-hidden="true" />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                <div className="px-3 py-4 border-t border-gray-200">
                    <div className="px-4 py-2 text-sm text-gray-500 truncate">{user?.email}</div>
                    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full transition-colors">
                        <HiLogout className="w-5 h-5" aria-hidden="true" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="bg-white border-b border-gray-200 px-4 py-3 lg:hidden">
                    <button onClick={() => setSidebarOpen(true)} className="p-1 text-gray-600" aria-label="Open sidebar">
                        <HiMenu className="w-6 h-6" />
                    </button>
                </header>
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
