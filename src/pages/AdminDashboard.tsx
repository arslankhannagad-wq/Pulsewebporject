import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { apiFetch } from '../lib/api';
import { DashboardAnalytics, User } from '../types';
import { Shield, Users, Layers, Film, Mail, ArrowUpRight, Award, Trash2, ShieldAlert, Sparkles, TrendingUp, Check } from 'lucide-react';

export default function AdminDashboard() {
  const { user, showToast } = useAuth();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadAdminWorkspace();
    }
  }, [user]);

  const loadAdminWorkspace = async () => {
    try {
      setLoading(true);
      const analyticsData = await apiFetch<DashboardAnalytics>('/api/admin/analytics');
      setAnalytics(analyticsData);

      const usersData = await apiFetch<any[]>('/api/admin/users');
      setUsersList(usersData);
    } catch (err: any) {
      showToast(err.message || 'Error occurred loading admin panel analytics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerify = async (userId: string) => {
    try {
      const res = await apiFetch<{ success: boolean; isVerified: boolean }>(`/api/admin/users/${userId}/verify`, {
        method: 'POST',
      });
      setUsersList(prev => prev.map(u => (u.id === userId ? { ...u, isVerified: res.isVerified } : u)));
      showToast(`User verification state updated!`, 'success');
      loadAdminWorkspace(); // refresh
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleBanishUser = async (userId: string, username: string) => {
    if (userId === user?.id) {
      showToast('Cannot banish your own administration credentials!', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to completely BAN and DELETE user @${username}? This action is irreversible.`)) return;

    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      setUsersList(prev => prev.filter(u => u.id !== userId));
      showToast(`@${username} has been banished from Pulse social streams`, 'info');
      loadAdminWorkspace(); // refresh
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-8 select-none text-zinc-400 md:pl-[272px]">
        <ShieldAlert className="h-10 w-10 text-rose-500 mb-3 animate-bounce" />
        <h4 className="text-sm font-semibold text-white">Administration credential required</h4>
        <p className="text-xs text-zinc-650 max-w-xs mt-1">Authorized admin staff are allowed entry into this control panel workspace.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex justify-center pb-24 md:pb-8 select-none">
      <div className="w-full max-w-5xl p-4 md:p-8 md:pl-[272px] space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-400" /> Admin Command Center
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Real-time moderator monitoring, system health metrics, and user management.</p>
          </div>
          <button
            onClick={loadAdminWorkspace}
            className="text-[10px] tracking-wider uppercase font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-1.5 cursor-pointer"
          >
            Hot Reload Analytics
          </button>
        </div>

        {loading || !analytics ? (
          <div className="h-60 flex flex-col items-center justify-center gap-2 text-zinc-500 font-mono text-xs">
            <Sparkles className="h-6 w-6 text-indigo-500 animate-spin" />
            <span>CALCULATING METRIC EQUATIONS...</span>
          </div>
        ) : (
          <>
            {/* Grid Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4.5">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Users</span>
                  <Users className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black">{analytics.totalUsers}</span>
                  <span className="text-[9px] text-emerald-400 font-medium font-mono flex items-center gap-0.5"><TrendingUp className="h-2.5 w-2.5" /> +100%</span>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4.5">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">General Posts</span>
                  <Layers className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black">{analytics.totalPosts}</span>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4.5">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Vertical Reels</span>
                  <Film className="h-4 w-4 text-rose-450" />
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black">{analytics.totalReels}</span>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4.5">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Today</span>
                  <Award className="h-4 w-4 text-pink-500 animate-pulse" />
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black">{analytics.activeToday}</span>
                  <span className="text-[9px] text-zinc-450 font-medium font-mono">Real-time now</span>
                </div>
              </div>
            </div>

            {/* Graphical Analytics (Drawn beautiful performant SVGs without external burdens!) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* SVG Line Graph */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-3">
                <h4 className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">System Post Trends (Last 7 Days)</h4>
                <div className="aspect-[1.8/1] bg-black/60 rounded-xl p-3 border border-zinc-900/50 flex flex-col justify-between">
                  {/* Grid Lines Overlay */}
                  <div className="relative w-full h-40">
                    <svg className="w-full h-full" viewBox="0 0 400 160">
                      {/* Grid background rails */}
                      <line x1="0" y1="40" x2="400" y2="40" stroke="#18181b" strokeWidth="1" />
                      <line x1="0" y1="80" x2="400" y2="80" stroke="#18181b" strokeWidth="1" />
                      <line x1="0" y1="120" x2="400" y2="120" stroke="#18181b" strokeWidth="1" />

                      {/* Continuous plotting string line builder */}
                      {(() => {
                        const pathString = analytics.postsOverTime.map((item, index) => {
                          const x = (index / (analytics.postsOverTime.length - 1)) * 360 + 20;
                          // map count safely to coordinates (max 10 count standard)
                          const y = 140 - Math.min(10, item.count) * 12;
                          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ');

                        return (
                          <>
                            <path d={pathString} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            {analytics.postsOverTime.map((item, index) => {
                              const x = (index / (analytics.postsOverTime.length - 1)) * 360 + 20;
                              const y = 140 - Math.min(10, item.count) * 12;
                              return <circle key={index} cx={x} cy={y} r="4" className="fill-indigo-400 stroke-black stroke-2" />;
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>

                  {/* Date mapping tags below */}
                  <div className="flex justify-between px-2 text-[8px] font-mono text-zinc-500">
                    {analytics.postsOverTime.map(item => (
                      <span key={item.date}>{item.date.split('-').slice(1).join('/')}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* PIE CHART DISTRIBUTION */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-3">
                <h4 className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">User Authentication Roles</h4>
                <div className="aspect-[1.8/1] bg-black/60 rounded-xl p-4 border border-zinc-900/50 flex items-center justify-around">
                  {/* Raw SVG Pie Slices */}
                  <div className="relative h-28 w-28">
                    <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 36 36">
                      {/* slice 1: admin */}
                      {(() => {
                        const adminCount = analytics.userRolesDistribution.find(d => d.role === 'admin')?.count || 0;
                        const userCount = analytics.userRolesDistribution.find(d => d.role === 'user')?.count || 0;
                        const total = adminCount + userCount || 1;
                        const adminPercent = (adminCount / total) * 100;
                        const adminStroke = adminPercent;
                        const userStroke = 100 - adminPercent;

                        return (
                          <>
                            <circle cx="18" cy="18" r="15.915" fill="none" class="stroke-zinc-800" strokeWidth="3.2" />
                            {/* Slice admin */}
                            <circle cx="18" cy="18" r="15.915" fill="none" className="stroke-indigo-500" strokeWidth="3.2" strokeDasharray={`${adminStroke} ${100 - adminStroke}`} strokeDashoffset="0" />
                          </>
                        );
                      })()}
                    </svg>
                  </div>

                  {/* Legend listing values */}
                  <div className="space-y-2">
                    {analytics.userRolesDistribution.map(item => (
                      <div key={item.role} className="flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded ${
                          item.role === 'admin' ? 'bg-indigo-500' : 'bg-zinc-800'
                        }`} />
                        <span className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-widest">
                          {item.role}: <strong className="text-white text-xs">{item.count}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Moderation / Users list table controls */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl space-y-4 p-5">
              <h4 className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">Administrative User Management</h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-400 font-mono">
                  <thead className="bg-zinc-900 text-zinc-500 border-b border-zinc-850 text-[9px] uppercase tracking-wider">
                    <tr>
                      <th className="p-4 rounded-tl-xl">Avatar</th>
                      <th className="p-4">Staff Handles</th>
                      <th className="p-4">Mail Connection</th>
                      <th className="p-4">Verified</th>
                      <th className="p-4 rounded-tr-xl">Banish Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/60 bg-black/40">
                    {usersList.map((usr: User) => (
                      <tr key={usr.id} className="hover:bg-zinc-900/40">
                        <td className="p-4">
                          <img src={usr.avatar} alt="Table user" className="h-8 w-8 rounded-full border border-zinc-800" />
                        </td>
                        <td className="p-4 font-semibold text-white">
                          @{usr.username}
                          <span className="text-[9px] text-zinc-500 block font-normal mt-0.5">{usr.fullname}</span>
                        </td>
                        <td className="p-4 text-zinc-505">{usr.email}</td>
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleVerify(usr.id)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              usr.isVerified
                                ? 'bg-indigo-950/40 border-indigo-805 text-indigo-400'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
                            title="Toggle Verification Badge"
                          >
                            <Award className="h-4.5 w-4.5" />
                          </button>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleBanishUser(usr.id, usr.username)}
                            className={`p-2 bg-rose-950/20 hover:bg-rose-900/30 border border-rose-900/30 text-rose-450 rounded-xl transition-all cursor-pointer ${
                              usr.id === user.id ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title="Banish User Forever"
                            disabled={usr.id === user.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
