import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  Home,
  Search,
  Film,
  MessageSquare,
  Bell,
  User as UserIcon,
  PlusSquare,
  Compass,
  LogOut,
  Shield,
  Activity
} from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unseenNotifications, setUnseenNotifications] = useState(false);
  const [unseenMessages, setUnseenMessages] = useState(false);

  // Poll for notifications/messages updates
  useEffect(() => {
    if (!user) return;
    const checkBadges = async () => {
      try {
        const notifs = await apiFetch<any[]>('/api/notifications');
        const hasUnseenNotif = notifs.some(n => !n.isSeen);
        setUnseenNotifications(hasUnseenNotif);

        const chats = await apiFetch<any[]>('/api/chats');
        const hasUnseenMsg = chats.some(c => c.lastMessageSenderId !== user.id && !c.lastMessageSeen);
        setUnseenMessages(hasUnseenMsg);
      } catch (err) {
        // fail silently or retry
      }
    };
    checkBadges();
    const interval = setInterval(checkBadges, 8000);
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  if (!user) return null;

  return (
    <>
      {/* DESKTOP/TABLET SIDEBAR NAVIGATION */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 border-r border-zinc-800 bg-black p-5 h-screen justify-between z-40">
        <div className="flex flex-col gap-8 w-full">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer pt-3 pl-2" onClick={() => navigate('/')}>
            <div className="h-9 w-9 bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.3)]">
              <span className="font-mono text-xl font-black text-white italic tracking-tighter">P</span>
            </div>
            <span className="font-sans text-2xl font-black bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent italic tracking-tight">PULSE</span>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-2">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                }`
              }
            >
              <Home className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span>Home Feed</span>
            </NavLink>

            <NavLink
              to="/explore"
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                }`
              }
            >
              <Compass className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span>Explore</span>
            </NavLink>

            <NavLink
              to="/reels"
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                }`
              }
            >
              <Film className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span>Reels</span>
            </NavLink>

            <NavLink
              to="/messages"
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-xl relative transition-all duration-200 group ${
                  isActive ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                }`
              }
            >
              <MessageSquare className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span>Messages</span>
              {unseenMessages && (
                <span className="absolute left-7 top-3 h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse border border-black" />
              )}
            </NavLink>

            <NavLink
              to="/notifications"
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-xl relative transition-all duration-200 group ${
                  isActive ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                }`
              }
            >
              <Bell className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span>Notifications</span>
              {unseenNotifications && (
                <span className="absolute left-7 top-3 h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse border border-black" />
              )}
            </NavLink>

            <NavLink
              to={`/profile/@${user.username}`}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                }`
              }
            >
              <div className="h-5 w-5 rounded-full overflow-hidden border border-zinc-700 group-hover:border-white transition-colors">
                <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" />
              </div>
              <span className="truncate">Profile</span>
            </NavLink>

            {/* Admin Dashboard */}
            {user.role === 'admin' && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group border border-zinc-900 ${
                    isActive ? 'bg-indigo-950/40 border-indigo-800 text-indigo-200 font-semibold' : 'text-zinc-400 hover:text-white hover:bg-indigo-950/20 hover:border-indigo-900/50'
                  }`
                }
              >
                <Shield className="h-5 w-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>Admin Dashboard</span>
              </NavLink>
            )}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col gap-2 w-full border-t border-zinc-900 pt-4">
          <button
            onClick={logout}
            className="flex items-center gap-4 px-4 py-3 w-full text-zinc-400 hover:text-rose-400 hover:bg-rose-950/10 rounded-xl transition-all duration-200 cursor-pointer"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MOBILE TOP BAR NAVIGATION */}
      <header className="md:hidden flex items-center justify-between fixed top-0 left-0 right-0 h-14 bg-black border-b border-zinc-900 px-4 z-40">
        <div className="flex items-center gap-2" onClick={() => navigate('/')}>
          <div className="h-7 w-7 bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-500 rounded-lg flex items-center justify-center">
            <span className="font-mono text-xs font-black text-white italic tracking-tighter">P</span>
          </div>
          <span className="font-sans text-lg font-black bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent italic tracking-tight">PULSE</span>
        </div>

        <div className="flex items-center gap-4">
          <NavLink to="/notifications" className="relative text-zinc-400 hover:text-white">
            <Bell className="h-5 w-5" />
            {unseenNotifications && (
              <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse border border-black" />
            )}
          </NavLink>
          <NavLink to="/messages" className="relative text-zinc-400 hover:text-white">
            <MessageSquare className="h-5 w-5" />
            {unseenMessages && (
              <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse border border-black" />
            )}
          </NavLink>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden flex items-center justify-around fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-zinc-950/80 backdrop-blur-md px-2 z-40 pb-safe">
        <NavLink
          to="/"
          className={({ isActive }) => `flex flex-col items-center p-2 rounded-lg ${isActive ? 'text-white' : 'text-zinc-500'}`}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] mt-1 font-medium">Home</span>
        </NavLink>

        <NavLink
          to="/explore"
          className={({ isActive }) => `flex flex-col items-center p-2 rounded-lg ${isActive ? 'text-white' : 'text-zinc-500'}`}
        >
          <Search className="h-5 w-5" />
          <span className="text-[10px] mt-1 font-medium">Explore</span>
        </NavLink>

        <NavLink
          to="/reels"
          className={({ isActive }) => `flex flex-col items-center p-2 rounded-lg ${isActive ? 'text-white' : 'text-zinc-500'}`}
        >
          <Film className="h-5 w-5" />
          <span className="text-[10px] mt-1 font-medium">Reels</span>
        </NavLink>

        <NavLink
          to={`/profile/@${user.username}`}
          className={({ isActive }) => `flex flex-col items-center p-2 rounded-lg ${isActive ? 'text-white' : 'text-zinc-500'}`}
        >
          <div className="h-5 w-5 rounded-full overflow-hidden border border-zinc-700">
            <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" />
          </div>
          <span className="text-[10px] mt-1 font-medium">Profile</span>
        </NavLink>

        {user.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) => `flex flex-col items-center p-2 rounded-lg ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`}
          >
            <Shield className="h-5 w-5" />
            <span className="text-[10px] mt-1 font-medium">Admin</span>
          </NavLink>
        )}
      </nav>
    </>
  );
}
