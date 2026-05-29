import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { LogIn, Sparkles, Key, AtSign } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) return;

    setLoading(true);
    try {
      await login(usernameOrEmail, password);
      navigate('/');
    } catch (err) {
      // toast is taken care of by auth context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black flex items-center justify-center p-4">
      {/* Container wrapper */}
      <div className="w-full max-w-md relative select-none">
        {/* Glow backdrop decorative vectors */}
        <div className="absolute -top-12 -left-12 h-44 w-44 rounded-full bg-rose-500/10 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 h-44 w-44 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />

        {/* Core Form Card */}
        <div className="bg-zinc-950 border border-zinc-800/80 p-8 rounded-2xl shadow-2xl relative z-10">
          {/* Logo Heading */}
          <div className="text-center mb-8">
            <div className="h-14 w-14 bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-2xl mx-auto mb-4 animate-pulse">
              <span className="font-mono text-3xl font-black text-white italic tracking-tighter">P</span>
            </div>
            <h2 className="font-sans text-3xl font-black bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent italic tracking-tight">
              PULSE
            </h2>
            <p className="text-xs text-zinc-500 mt-2 font-medium">The heartbeat of modern social networks. Explore with zero noise.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input username or email */}
            <div className="space-y-1.5ClassName">
              <label className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase block">Username / Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <AtSign className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={usernameOrEmail}
                  onChange={e => setUsernameOrEmail(e.target.value)}
                  placeholder="Enter username or email"
                  className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl py-3 pl-11 pr-4 text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition-all"
                />
              </div>
            </div>

            {/* Input password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase block">Password Credential</label>
                <Link
                  to="/forgot-password"
                  className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Key className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password connection badge"
                  className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl py-3 pl-11 pr-4 text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 border border-rose-500/20 hover:opacity-95 disabled:opacity-50 text-white rounded-xl py-3 text-xs font-semibold shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              <span>{loading ? 'Validating session credentials...' : 'Enter Pulse Session'}</span>
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-zinc-500 border-t border-zinc-900 pt-5">
            <span>New here? </span>
            <Link to="/signup" className="text-indigo-400 font-semibold hover:text-indigo-300 hover:underline">
              Create an account now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
