import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { apiFetch, isVideoUrl } from '../lib/api';
import { User, Post } from '../types';
import CommentsModal from '../components/CommentsModal';
import { Settings, Grid, Bookmark, Award, UserPlus, Check, ChevronLeft, Heart, MessageCircle, Sparkles, LogOut, Edit3, Trash, Share2 } from 'lucide-react';

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, showToast, logout, refreshUser } = useAuth();

  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Active state tab
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');

  // Modal Comments
  const [commentingPost, setCommentingPost] = useState<Post | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  // Connection Dialogue lists
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(false);
  const [connectionsType, setConnectionsType] = useState<'followers' | 'following'>('followers');
  const [connectionsList, setConnectionsList] = useState<User[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [fullnameVal, setFullnameVal] = useState('');
  const [bioVal, setBioVal] = useState('');
  const [avatarVal, setAvatarVal] = useState(''); // base64 payload
  const [savingSettings, setSavingSettings] = useState(false);
  const [postIdToDelete, setPostIdToDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenConnectionsModal = async (type: 'followers' | 'following') => {
    if (!targetUser) return;
    setConnectionsType(type);
    setIsConnectionsOpen(true);
    setConnectionsLoading(true);
    try {
      const data = await apiFetch<User[]>(`/api/users/${targetUser.id}/${type}`);
      setConnectionsList(data);
    } catch (err: any) {
      showToast(`Could not load ${type}`, 'error');
    } finally {
      setConnectionsLoading(false);
    }
  };

  const handleDeletePostDirect = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    setPostIdToDelete(postId);
  };

  const executeDeletePostDirect = async () => {
    if (!postIdToDelete) return;
    try {
      await apiFetch(`/api/posts/${postIdToDelete}`, { method: 'DELETE' });
      setPosts(prev => prev.filter(p => p.id !== postIdToDelete));
      setSavedPosts(prev => prev.filter(p => p.id !== postIdToDelete));
      showToast('Pulse deleted successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete post', 'error');
    } finally {
      setPostIdToDelete(null);
    }
  };

  // Parse @username routing cleanly
  const queryUsername = (username || '').replace('@', '').trim();

  useEffect(() => {
    if (queryUsername) {
      loadProfileData();
    }
  }, [username]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{ user: User; posts: Post[] }>(`/api/users/profile/${queryUsername}`);
      setTargetUser(data.user);
      setPosts(data.posts);

      // Preset edit form structures if self
      if (currentUser && data.user.id === currentUser.id) {
        setFullnameVal(data.user.fullname || '');
        setBioVal(data.user.bio || '');
        setAvatarVal(data.user.avatar || '');
      }

      // Fetch saved posts if self
      if (currentUser && data.user.id === currentUser.id) {
        const explorePosts = await apiFetch<Post[]>('/api/posts/search');
        const selfSavedKeys = data.user.savedPosts || [];
        const filteredSaved = explorePosts.filter(p => selfSavedKeys.includes(p.id));
        setSavedPosts(filteredSaved);
      }
    } catch (err: any) {
      showToast('Creator profile could not be retrieved', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowProfile = async () => {
    if (!targetUser) return;
    try {
      const res = await apiFetch(`/api/users/${targetUser.id}/follow`, { method: 'POST' });
      showToast(res.message, 'success');

      // Update follow stats locally to avoid laggy UI refreshing
      setTargetUser(prev => {
        if (!prev) return null;
        const followersList = [...prev.followers];
        if (res.following) {
          if (!followersList.includes(currentUser!.id)) followersList.push(currentUser!.id);
        } else {
          const idx = followersList.indexOf(currentUser!.id);
          if (idx > -1) followersList.splice(idx, 1);
        }
        return { ...prev, followers: followersList };
      });
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleChooseAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarVal(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const result = await apiFetch<{ user: User }>('/api/auth/profile', {
        method: 'PUT',
        body: {
          fullname: fullnameVal,
          bio: bioVal,
          avatar: avatarVal,
        },
      });

      setTargetUser(result.user);
      await refreshUser();
      setIsEditing(false);
      showToast('Pulse credentials updated! ⚙️', 'success');
      loadProfileData(); // refresh
    } catch (err: any) {
      showToast(err.message || 'Error occurred saving settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const openComments = (post: Post) => {
    setCommentingPost(post);
    setIsCommentsOpen(true);
  };

  const updateCommentsCountInProfile = (postId: string, newCount: number) => {
    const patcher = (p: Post) => (p.id === postId ? { ...p, commentsCount: newCount } : p);
    setPosts(prev => prev.map(patcher));
    setSavedPosts(prev => prev.map(patcher));
    if (commentingPost && commentingPost.id === postId) {
      setCommentingPost(prev => (prev ? { ...prev, commentsCount: newCount } : null));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-zinc-500 font-mono tracking-widest text-xs select-none">
        <Sparkles className="h-6 w-6 text-indigo-500 animate-spin mb-2" />
        <span>GATHERING INVENTORY DATA...</span>
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-8 select-none text-zinc-400">
        <span className="text-3xl">🌌</span>
        <h4 className="text-sm font-bold text-white mt-1">Creator not found</h4>
        <p className="text-xs text-zinc-650 max-w-xs mt-0.5 leading-normal">
          This user profile URL is invalid, or the creator account has been deleted by an admin.
        </p>
        <button onClick={() => navigate('/')} className="mt-4 text-xs font-semibold px-4 py-2 bg-zinc-90 w-fit rounded-lg cursor-pointer">
          Back to Timeline
        </button>
      </div>
    );
  }

  const isSelf = currentUser && targetUser.id === currentUser.id;
  const isFollowingTarget = currentUser && targetUser.followers.includes(currentUser.id);

  return (
    <div className="min-h-screen bg-black text-zinc-150 flex justify-center pb-24 md:pb-8 select-none">
      <div className="w-full max-w-5xl p-4 md:p-8 md:pl-[272px] space-y-10">
        {/* Profile Card Summary */}
        <div className="bg-zinc-950 border border-zinc-900/80 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
            {/* Avatar & Identifiers */}
            <div className="flex items-center gap-5">
              <div className="relative h-20 w-20 md:h-24 md:w-24 rounded-full p-1 bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-500 flex items-center justify-center">
                <div className="h-full w-full rounded-full bg-black p-0.5 flex items-center justify-center overflow-hidden border border-black/30">
                  <img src={isSelf ? currentUser.avatar : targetUser.avatar} alt="Profile Avatar" className="h-full w-full object-cover rounded-full" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg md:text-xl font-black text-white">@{targetUser.username}</h2>
                  {targetUser.isVerified && (
                    <Award className="h-4 w-4 text-indigo-400 fill-indigo-400/20" title="Verified Member" />
                  )}
                  {targetUser.role === 'admin' && (
                    <span className="text-[9px] uppercase tracking-widest font-extrabold px-1.5 py-0.5 bg-indigo-950 border border-indigo-700/50 text-indigo-300 rounded">
                      Staff
                    </span>
                  )}
                </div>
                <h3 className="text-xs text-zinc-400 mt-1 font-semibold">{isSelf ? currentUser.fullname : targetUser.fullname}</h3>
                <span className="text-[10px] text-zinc-500 font-mono block mt-1">Pulse Joiner since {new Date(targetUser.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Profile CTA Controls */}
            <div className="flex items-center gap-2">
              {isSelf ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-200 hover:bg-zinc-850 cursor-pointer transition-all"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    onClick={logout}
                    className="p-2.5 bg-rose-955 hover:bg-rose-950/20 border border-rose-900/30 text-rose-450 hover:text-rose-400 rounded-xl cursor-pointer transition-colors"
                    title="Sign Out of Session"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleFollowProfile}
                    className={`flex items-center justify-center gap-1.5 px-5 py-2.5 min-w-28 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                      isFollowingTarget
                        ? 'bg-zinc-900 border border-zinc-700/80 text-zinc-400 hover:bg-zinc-800'
                        : 'bg-indigo-650 text-white shadow-xl shadow-indigo-600/20'
                    }`}
                  >
                    {isFollowingTarget ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      // Generate chat or redirect to chats
                      apiFetch('/api/chats', {
                        method: 'POST',
                        body: { recipientId: targetUser.id },
                      }).then(() => {
                        navigate('/messages');
                      }).catch(() => {
                        showToast('Error opening talk rooms', 'error');
                      });
                    }}
                    className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 font-semibold text-xs text-zinc-200 rounded-xl hover:bg-zinc-850 cursor-pointer"
                  >
                    Message
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Followers / Posts Count statistics columns */}
          <div className="grid grid-cols-3 gap-3 bg-zinc-900/40 p-4 border border-zinc-900 rounded-xl text-center">
            <div>
              <span className="text-sm font-extrabold text-white block">{posts.length}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-0.5">Posts</span>
            </div>
            <div 
              onClick={() => handleOpenConnectionsModal('followers')}
              className="cursor-pointer hover:bg-zinc-900/60 transition-colors py-1.5 rounded-lg border border-transparent hover:border-zinc-800"
            >
              <span className="text-sm font-extrabold text-indigo-400 hover:text-indigo-300 block">{targetUser.followers.length}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-0.5">Followers</span>
            </div>
            <div 
              onClick={() => handleOpenConnectionsModal('following')}
              className="cursor-pointer hover:bg-zinc-900/60 transition-colors py-1.5 rounded-lg border border-transparent hover:border-zinc-800"
            >
              <span className="text-sm font-extrabold text-indigo-400 hover:text-indigo-300 block">{targetUser.following.length}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-0.5">Following</span>
            </div>
          </div>

          {/* User Bio text */}
          <div className="space-y-1 bg-zinc-910 p-4 rounded-xl">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#52525b]">Creator Bio</h4>
            <p className="text-zinc-200 text-xs leading-relaxed italic">
              {isSelf ? currentUser.bio : targetUser.bio || 'This user has neglected setting up a custom bio. 🍃'}
            </p>
          </div>
        </div>

        {/* Saved Posts vs Published Posts Tabs */}
        <div className="space-y-6">
          <div className="flex border-b border-zinc-900">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'posts' ? 'border-indigo-500 text-white bg-zinc-950/20' : 'border-transparent text-zinc-500 hover:text-zinc-350'
              }`}
            >
              <Grid className="h-3.5 w-3.5" /> Published Pulse ({posts.length})
            </button>
            {isSelf && (
              <button
                onClick={() => setActiveTab('saved')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'saved' ? 'border-indigo-500 text-white bg-zinc-950/20' : 'border-transparent text-zinc-500 hover:text-zinc-350'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" /> Bookmarks / Saved ({savedPosts.length})
              </button>
            )}
          </div>

          {/* TAB Grid Lists content */}
          {activeTab === 'posts' ? (
            posts.length === 0 ? (
              <div className="text-center py-20 bg-zinc-950 border border-zinc-900 rounded-2xl">
                <span className="text-3xl">🌌</span>
                <h4 className="text-sm font-bold text-zinc-300 mt-2">Zero publications shared yet</h4>
                <p className="text-xs text-zinc-500 mt-1">This creator timeline has not uploaded visual media yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                {posts.map(post => (
                  <div
                    key={post.id}
                    onClick={() => openComments(post)}
                    className="relative group bg-zinc-900 rounded-xl overflow-hidden aspect-square border-2 border-transparent hover:border-indigo-500/20 cursor-pointer transition-all"
                  >
                    {isVideoUrl(post.mediaUrls[0]) ? (
                      <video src={post.mediaUrls[0]} muted playsInline className="h-full w-full object-cover group-hover:scale-105 duration-300 transition-all" />
                    ) : (
                      <img src={post.mediaUrls[0]} alt="Grid media" className="h-full w-full object-cover group-hover:scale-105 duration-300 transition-all" />
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-5 transition-all">
                      <div className="flex items-center gap-1.5 text-rose-450 font-bold text-xs"><Heart className="h-4 w-4 fill-rose-500 text-rose-500" /><span>{post.likes.length}</span></div>
                      <div className="flex items-center gap-1.5 text-white font-bold text-xs"><MessageCircle className="h-4 w-4" /><span>{post.commentsCount || 0}</span></div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `${window.location.origin}/profile/@${post.username}?postId=${post.id}`;
                          navigator.clipboard.writeText(url);
                          showToast('Pulse post link copied to clipboard! 🔗', 'success');
                        }}
                        className="hover:text-indigo-400 text-zinc-400 p-1.5 rounded-lg hover:bg-zinc-900 transition-colors"
                        title="Share Post Link"
                      >
                        <Share2 className="h-4.5 w-4.5" />
                      </button>
                      {(post.userId === currentUser?.id || currentUser?.role === 'admin') && (
                        <button
                          type="button"
                          onClick={(e) => handleDeletePostDirect(e, post.id)}
                          className="hover:text-rose-500 text-zinc-400 p-1.5 rounded-lg hover:bg-rose-950/20 transition-colors"
                          title="Delete Post"
                        >
                          <Trash className="h-4.5 w-4.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Saved list
            savedPosts.length === 0 ? (
              <div className="text-center py-20 bg-zinc-950 border border-zinc-900 rounded-2xl">
                <span className="text-3xl">🔖</span>
                <h4 className="text-sm font-bold text-zinc-350 mt-1.5">No bookmark captures found</h4>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">Click the bookmark icon underneath feed pieces to quickly cache them on your profile workspace.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                {savedPosts.map(post => (
                  <div
                    key={post.id}
                    onClick={() => openComments(post)}
                    className="relative group bg-zinc-900 rounded-xl overflow-hidden aspect-square border-2 border-transparent hover:border-indigo-500/20 cursor-pointer transition-all"
                  >
                    {isVideoUrl(post.mediaUrls[0]) ? (
                      <video src={post.mediaUrls[0]} muted playsInline className="h-full w-full object-cover group-hover:scale-105 duration-350 transform transition" />
                    ) : (
                      <img src={post.mediaUrls[0]} alt="Saved Grid content" className="h-full w-full object-cover group-hover:scale-105 duration-350 transform transition" />
                    )}
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-5 transition-fade">
                      <div className="flex items-center gap-1 text-xs text-rose-500 font-bold"><Heart className="h-4.5 w-4.5 fill-rose-500" /><span>{post.likes.length}</span></div>
                      <div className="flex items-center gap-1 text-xs text-white font-bold"><MessageCircle className="h-4.5 w-4.5" /><span>{post.commentsCount || 0}</span></div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `${window.location.origin}/profile/@${post.username}?postId=${post.id}`;
                          navigator.clipboard.writeText(url);
                          showToast('Pulse post link copied to clipboard! 🔗', 'success');
                        }}
                        className="hover:text-indigo-400 text-zinc-400 p-1.5 rounded-lg hover:bg-zinc-900 transition-colors"
                        title="Share Post Link"
                      >
                        <Share2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* QUICK SETUPS OVERLAYS (EDIT PROFILE) */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl w-full max-w-sm p-6 space-y-5 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-indigo-400" /> Modify Pulse credentials
              </h4>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-zinc-500 hover:text-white px-2.5 py-1 rounded bg-zinc-900"
              >
                Close
              </button>
            </div>

            {/* Editing form details */}
            <form onSubmit={handleSaveChanges} className="space-y-4">
              {/* Avatar upload details */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative h-16 w-16 rounded-full overflow-hidden border border-zinc-800 bg-zinc-900">
                  <img src={avatarVal || currentUser?.avatar} alt="Profile previews" className="h-full w-full object-cover" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleChooseAvatarFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-zinc-900 hover:bg-zinc-800 text-[10px] uppercase font-bold tracking-wider text-zinc-400 px-3 py-1 bg-zinc-915 rounded"
                >
                  Change Profile Image
                </button>
              </div>

              {/* Full name input */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase block tracking-wide">Display Full Name</label>
                <input
                  type="text"
                  required
                  value={fullnameVal}
                  onChange={e => setFullnameVal(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/80"
                />
              </div>

              {/* Bio input */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase block tracking-wide">Tell Us Your Vibe (Bio)</label>
                <textarea
                  rows={3}
                  value={bioVal}
                  onChange={e => setBioVal(e.target.value)}
                  placeholder="Tell people about your vibe..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/80"
                />
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-lg shadow-indigo-600/25"
              >
                {savingSettings ? 'Saving new credentials...' : 'Save dynamic credentials'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* REUSABLE EXPLORE COMMENTS overlay */}
      {commentingPost && (
        <CommentsModal
          post={commentingPost}
          isOpen={isCommentsOpen}
          onClose={() => {
            setIsCommentsOpen(false);
            setCommentingPost(null);
          }}
          onCommentCountUpdated={(newCount) => updateCommentsCountInProfile(commentingPost.id, newCount)}
          onPostDeleted={(deletedId) => {
            setPosts(prev => prev.filter(p => p.id !== deletedId));
            setSavedPosts(prev => prev.filter(p => p.id !== deletedId));
          }}
        />
      )}

      {/* FOLLOWERS / FOLLOWING DIALOG OVERLAY */}
      {postIdToDelete && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 text-center space-y-4 shadow-2xl animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto">
              <Trash className="h-5 w-5" />
            </div>
            <h3 className="text-zinc-100 font-bold text-sm">Delete Pulse Post</h3>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
              Are you sure you want to delete this Pulse from your timeline forever? This action cannot be undone.
            </p>
            <div className="flex gap-3 w-full mt-2">
              <button
                type="button"
                onClick={() => setPostIdToDelete(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-850 text-zinc-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeletePostDirect}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isConnectionsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[450px]">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900 flex-shrink-0">
              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
                👥 {connectionsType === 'followers' ? 'Followers' : 'Following'}
              </h4>
              <button
                type="button"
                onClick={() => setIsConnectionsOpen(false)}
                className="text-xs text-zinc-500 hover:text-white px-2.5 py-1 rounded bg-zinc-900"
              >
                Close
              </button>
            </div>

            {/* List entries */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
              {connectionsLoading ? (
                <div className="text-center py-8 text-zinc-500 font-mono text-xs select-none">
                  <Sparkles className="h-4 w-4 text-indigo-500 animate-spin mx-auto mb-2" />
                  <span>METADATA READING...</span>
                </div>
              ) : connectionsList.length === 0 ? (
                <div className="text-center py-8 text-zinc-550 text-xs">
                  No users to show.
                </div>
              ) : (
                connectionsList.map((connUser) => (
                  <div
                    key={connUser.id}
                    onClick={() => {
                      setIsConnectionsOpen(false);
                      navigate(`/profile/@${connUser.username}`);
                    }}
                    className="p-2.5 bg-zinc-900/60 hover:bg-zinc-850 rounded-xl border border-zinc-850 flex items-center gap-3 cursor-pointer transition-colors"
                  >
                    <img
                      src={connUser.avatar}
                      alt={connUser.username}
                      className="h-9 w-9 rounded-full border border-zinc-800 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-white block truncate">@{connUser.username}</span>
                      <span className="text-[10px] text-zinc-400 block truncate">{connUser.fullname}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
