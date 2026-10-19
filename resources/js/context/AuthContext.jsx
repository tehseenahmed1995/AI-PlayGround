import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            api.get('/user')
                .then((res) => setUser(res.data.data || res.data))
                .catch(() => localStorage.removeItem('token'))
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (email, password) => {
        const res = await api.post('/login', { email, password });
        localStorage.setItem('token', res.data.token);
        setUser(res.data.user.data || res.data.user);
        return res.data;
    };

    const register = async (name, email, password, password_confirmation) => {
        const res = await api.post('/register', { name, email, password, password_confirmation });
        localStorage.setItem('token', res.data.token);
        setUser(res.data.user.data || res.data.user);
        return res.data;
    };

    const logout = async () => {
        await api.post('/logout').catch(() => {});
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
