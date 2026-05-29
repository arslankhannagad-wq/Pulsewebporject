import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { apiFetch } from '../lib/api';
import { ShieldCheck, Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const { showToast } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: { email }
      });
      setSuccess(true);
      showToast(res.message || 'Simulated reset guidelines triggered!', 'success');
    } catch (err: any) {
      showToast(err.message || 'No user registered with this email address', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black flex items-center justify-center p-4 selection:bg-indigo-500/30">
      <div className="w-full max-w-sm relative select-none">
        {/* Glow decorative backdrop details */}
        <div className="absolute -top-12 -left-12 h-44 w-44 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />

        <div className="bg-zinc-950 border border-zinc-900/80 p-6 md:p-8 rounded-2xl shadow-2xl relative z-10">
          {/* Back to Login trigger */}
          <Link to="/login" className="text-zinc-500 hover:text-white flex items-center gap-1 text-xs mb-6 font-semibold w-fit">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Entry
          </Link>

          {/* Heading */}
          <div className="space-y-2 mb-6">
            <h3 className="font-sans text-xl font-black bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent italic tracking-tight uppercase">
              Retrieve Access
            </h3>
            <p className="text-xs text-zinc-500 leading-normal font-medium">
              Forgot your Pulse entry credentials? Enter your registered email address below, and we will send a simulated reset link.
            </p>
          </div>

          {success ? (
            <div className="p-4 bg-indigo-950/40 border border-indigo-800 rounded-xl space-y-3.5">
              <div className="flex items-center gap-2.5 text-indigo-300">
                <ShieldCheck className="h-5 w-5 flex-shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">Simulated Reset Sent</span>
              </div>
              <p className="text-[11px] text-indigo-200 leading-normal">
                Perfect! We simulated sending reset directions successfully to <strong className="text-white">{email}</strong>. For quick testing, you can use standard mock user logins listed on the Login page!
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-indigo-650 hover:bg-indigo-500 text-white rounded-lg py-2 text-xs font-semibold cursor-pointer"
              >
                Back to Login Screen
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase block tracking-wider">System Registered Email</label>
                <div className="relative">
                  <Mail className="absolute inset-y-0 left-3.5 h-4 w-4 text-zinc-500 my-auto" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. sarah@travel.com"
                    className="w-full bg-zinc-90 w-90 border border-zinc-800 rounded-xl py-2.5 pl-11 pr-4 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 placeholder-zinc-650"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-rose-500 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg transition-transform active:scale-[0.98]"
              >
                {loading ? 'Confirming details...' : 'Trigger Recovery Sequence'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
