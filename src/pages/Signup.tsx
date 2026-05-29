import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { UserPlus, AtSign, Key, UserIcon, Mail } from 'lucide-react';

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullname, setFullname] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Dynamic Avatar Generator derived from typing input
  const generatedAvatarSeed = username.toLowerCase().trim() || 'pulse_seed';
  const dicebearUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${generatedAvatarSeed}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !fullname || !password) return;

    setLoading(true);
    try {
      await register(username.trim().toLowerCase(), email.trim(), password, fullname.trim());
      navigate('/');
    } catch (err) {
      // toast alert handles errors in AuthContext
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md relative select-none">
        {/* Glow vector filters */}
        <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-rose-500/10 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />

        {/* Content Card */}
        <div className="bg-zinc-950 border border-zinc-800/80 p-8 rounded-2xl shadow-2xl relative z-10">
          <div className="text-center mb-6">
            <h2 className="font-sans text-2xl font-black bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent italic tracking-tight uppercase">
              Establish Pulse Profile
            </h2>
            <p className="text-xs text-zinc-500 mt-1.5">Configure your core telemetry. Join the community now.</p>
          </div>

          {/* Interactive Dynamic Avatar preview! */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative h-20 w-20 rounded-full p-1 bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-500 flex items-center justify-center animate-spin-slow">
              <div className="h-full w-full rounded-full bg-black p-0.5 flex items-center justify-center overflow-hidden">
                <img src={dicebearUrl} alt="Live avatar seed preview" className="h-full w-full object-cover rounded-full" />
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-widest font-semibold text-indigo-400 mt-2.5">Live avatar generated!</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1ClassName">
              <label className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase block">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <AtSign className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/\s+/g, ''))}
                  placeholder="traveler_sarah"
                  className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl py-2.5 pl-11 pr-4 text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase block">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <UserIcon className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullname}
                  onChange={e => setFullname(e.target.value)}
                  placeholder="Sarah Jenkins"
                  className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl py-2.5 pl-11 pr-4 text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase block">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="sarah@travel.com"
                  className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl py-2.5 pl-11 pr-4 text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* password */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase block">Access Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Key className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create secure pass badge"
                  className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl py-2.5 pl-11 pr-4 text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 border border-rose-500/20 hover:opacity-95 disabled:opacity-50 text-white rounded-xl py-3 text-xs font-semibold shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              <span>{loading ? 'Assembling Profile...' : 'Create Account & Agree'}</span>
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-zinc-500 border-t border-zinc-900 pt-5">
            <span>Already have a Pulse profile? </span>
            <Link to="/login" className="text-indigo-400 font-semibold hover:text-indigo-300 hover:underline">
              Enter Session
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
