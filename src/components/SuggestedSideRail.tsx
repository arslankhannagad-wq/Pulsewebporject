import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { apiFetch } from '../lib/api';
import { User } from '../types';
import { Check, UserPlus } from 'lucide-react';

export default function SuggestedSideRail() {
  const { user, showToast } = useAuth();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [followingStates, setFollowingStates] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (user) {
      loadSuggestions();
    }
  }, [user]);

  const loadSuggestions = async () => {
    try {
      const data = await apiFetch<User[]>('/api/users/suggestions');
      setSuggestions(data);
    } catch (err: any) {
      console.error('Error fetching suggestions:', err);
    }
  };

  const handleFollowUser = async (targetId: string, username: string) => {
    try {
      const res = await apiFetch(`/api/users/${targetId}/follow`, { method: 'POST' });
      setFollowingStates(prev => ({
        ...prev,
        [targetId]: res.following,
      }));
      showToast(res.message, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  if (!user) return null;

  return (
    <div className="w-full space-y-6 pt-3 select-none">
      {/* Self Profile Segment */}
      <div className="flex items-center justify-between">
        <div
          onClick={() => navigate(`/profile/@${user.username}`)}
          className="flex items-center gap-3.5 cursor-pointer group"
        >
          <img
            src={user.avatar}
            alt={user.username}
            className="h-12 w-12 rounded-full border border-zinc-800 object-cover group-hover:border-zinc-500 transition-all"
          />
          <div>
            <h4 className="text-xs font-semibold text-zinc-100 group-hover:underline">@{user.username}</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">{user.fullname}</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/profile/@${user.username}`)}
          className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
        >
          Manage Profile
        </button>
      </div>

      {/* suggestions Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-zinc-500 tracking-wider uppercase">Suggested Creators</span>
          <button
            onClick={loadSuggestions}
            className="text-[10px] font-semibold text-zinc-400 hover:text-white hover:underline transition-colors cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {/* creators list */}
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <p className="text-[10px] text-zinc-600 italic">No creator suggestions available at this moment.</p>
          ) : (
            suggestions.slice(0, 5).map(creator => {
              const isActiveFollowing = followingStates[creator.id];
              return (
                <div key={creator.id} className="flex items-center justify-between bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-900">
                  <div
                    onClick={() => navigate(`/profile/@${creator.username}`)}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <img
                      src={creator.avatar}
                      alt={creator.username}
                      className="h-9 w-9 rounded-full border border-zinc-800 object-cover group-hover:border-zinc-600"
                    />
                    <div className="max-w-[120px]">
                      <h5 className="text-[11px] font-semibold text-zinc-200 truncate group-hover:underline">
                        @{creator.username}
                      </h5>
                      <span className="text-[9px] text-zinc-500 truncate block">
                        {creator.isVerified ? '✓ Verified Creator' : 'Pulse Discovery'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleFollowUser(creator.id, creator.username)}
                    className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      isActiveFollowing
                        ? 'bg-zinc-850 text-zinc-400 border border-zinc-700/80 hover:bg-zinc-800'
                        : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30'
                    }`}
                  >
                    {isActiveFollowing ? (
                      <>
                        <Check className="h-2.5 w-2.5" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-2.5 w-2.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Aesthetic branding footer */}
      <footer className="text-[10px] text-zinc-600 pt-2 border-t border-zinc-900">
        <p className="leading-relaxed">&copy; 2026 PULSE SOCIAL LABS INC. Built with top-tier React Fullstack architecture.</p>
      </footer>
    </div>
  );
}
