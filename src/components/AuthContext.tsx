import React, { createContext, useContext, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { User } from '../types';
import { apiFetch } from '../lib/api';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, fullname: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  socket: Socket | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('pulse_token'));
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Setup Socket Connection on User Load
  useEffect(() => {
    if (user) {
      const socketConn = io(window.location.origin);
      socketConn.emit('register-user', user.id);

      socketConn.on('new-notification', (notif: any) => {
        showToast(`🔔 ${notif.username} ${notif.text}`, 'info');
      });

      socketConn.on('message-received', (msg: any) => {
        // Only trigger toast if user is not in the active direct message view
        if (!window.location.pathname.includes(`/messages`)) {
          showToast(`💬 New direct message received!`, 'info');
        }
      });

      setSocket(socketConn);

      return () => {
        socketConn.disconnect();
      };
    } else {
      setSocket(null);
    }
  }, [user]);

  // Initial user loading auth check
  const refreshUser = async () => {
    const curToken = localStorage.getItem('pulse_token');
    if (!curToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<{ user: User }>('/api/auth/me');
      setUser(data.user);
    } catch (err) {
      console.error('Failed to confirm session:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const login = async (usernameOrEmail: string, password: string) => {
    try {
      const data = await apiFetch<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: { usernameOrEmail, password },
      });
      localStorage.setItem('pulse_token', data.token);
      setToken(data.token);
      setUser(data.user);
      showToast(`Welcome back, @${data.user.username}! ✨`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Login failed. Check details.', 'error');
      throw err;
    }
  };

  const register = async (username: string, email: string, password: string, fullname: string) => {
    try {
      const data = await apiFetch<{ user: User; token: string }>('/api/auth/register', {
        method: 'POST',
        body: { username, email, password, fullname },
      });
      localStorage.setItem('pulse_token', data.token);
      setToken(data.token);
      setUser(data.user);
      showToast(`Account successfully set up! Welcome, ${fullname}! 🎉`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Registration failed', 'error');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('pulse_token');
    setToken(null);
    setUser(null);
    showToast('Logged out of Pulse session', 'info');
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      toasts,
      showToast,
      dismissToast,
      login,
      register,
      logout,
      refreshUser,
      socket
    }}>
      {children}

      {/* GLOBAL NOTIFICATION TOAST ENGINE */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-xl border text-sm flex items-center justify-between gap-3 animate-slide-in backdrop-blur-md transition-all duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/30 text-emerald-100'
                : toast.type === 'error'
                ? 'bg-rose-950/95 border-rose-500/30 text-rose-100'
                : 'bg-zinc-900/95 border-zinc-700/50 text-zinc-100'
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-xs hover:text-white hover:bg-white/10 p-1 rounded transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be defined inside an AuthProvider');
  }
  return context;
}
