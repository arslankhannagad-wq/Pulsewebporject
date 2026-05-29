import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { Notification } from '../types';
import { Bell, Heart, MessageSquare, UserPlus, CheckCircle } from 'lucide-react';

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Notification[]>('/api/notifications');
      setNotifications(data);

      // Perform a separate API command signaling they've read all alerts
      await apiFetch('/api/notifications/seen', { method: 'POST' });
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="h-4.5 w-4.5 fill-rose-500 text-rose-500" />;
      case 'comment':
        return <MessageSquare className="h-4.5 w-4.5 text-indigo-400" />;
      case 'follow':
        return <UserPlus className="h-4.5 w-4.5 text-emerald-400" />;
      default:
        return <Bell className="h-4.5 w-4.5 text-blue-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex justify-center pb-24 md:pb-8 select-none">
      <div className="w-full max-w-2xl p-4 md:p-8 md:pl-[272px] space-y-7">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-5">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-rose-500" /> Interaction Alerts
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Real-time telemetry tracking likes, comments, and new fans.</p>
          </div>
          <button
            onClick={loadNotifications}
            className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 cursor-pointer"
          >
            Clear alerts
          </button>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((__, idx) => (
              <div key={idx} className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 animate-pulse flex items-center gap-4">
                <div className="h-4 w-4 bg-zinc-850 rounded-full" />
                <div className="h-10 w-10 bg-zinc-850 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 bg-zinc-850 rounded" />
                  <div className="h-2 w-16 bg-zinc-850 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 bg-zinc-950 border border-zinc-900 rounded-2xl">
            <span className="text-3xl">🕊️</span>
            <h4 className="text-sm font-semibold text-zinc-200 mt-2">timeline is completely silent</h4>
            <p className="text-xs text-zinc-500 mt-1">When users interact with your Pulse postings, alerts pop up here.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  !notif.isSeen
                    ? 'bg-zinc-900/60 border-zinc-800/80 shadow-[inset_0_0_10px_rgba(129,140,248,0.05)]'
                    : 'bg-zinc-950/40 border-zinc-900'
                }`}
              >
                <div className="flex items-center gap-4.5">
                  {/* Icon */}
                  <div className="flex-shrink-0 bg-black/40 p-2 border border-zinc-850 rounded-lg">
                    {getNotifIcon(notif.type)}
                  </div>

                  {/* sender info avatar */}
                  <img 
                    src={notif.senderAvatar} 
                    alt="Sender Avatar" 
                    onClick={() => navigate(`/profile/@${notif.senderUsername}`)}
                    className="h-10 w-10 border border-zinc-800 rounded-full object-cover cursor-pointer hover:border-indigo-500" 
                  />

                  <div>
                    <p className="text-xs text-zinc-200 leading-normal">
                      <strong 
                        onClick={() => navigate(`/profile/@${notif.senderUsername}`)}
                        className="text-white hover:underline cursor-pointer"
                      >
                        @{notif.senderUsername}
                      </strong>{' '}
                      {notif.text}
                    </p>
                    <span className="text-[9px] text-zinc-500 block mt-1">
                      {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* blue dot if unseen */}
                {!notif.isSeen && (
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
