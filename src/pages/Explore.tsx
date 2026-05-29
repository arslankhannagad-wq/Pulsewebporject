import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, isVideoUrl } from '../lib/api';
import { Post, User } from '../types';
import CommentsModal from '../components/CommentsModal';
import { useAuth } from '../components/AuthContext';
import { Search, Compass, Grid, Sparkles, Heart, MessageCircle, Share2 } from 'lucide-react';

export default function Explore() {
  const navigate = useNavigate();
  const { showToast } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Post[]>([]);
  const [userResults, setUserResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal Comments detail
  const [commentingPost, setCommentingPost] = useState<Post | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  useEffect(() => {
    fetchExploreContent();
  }, [searchTerm]);

  const fetchExploreContent = async () => {
    setLoading(true);
    try {
      // Find matching posts
      const posts = await apiFetch<Post[]>(`/api/posts/search?q=${encodeURIComponent(searchTerm)}`);
      setSearchResults(posts);

      // Find matching users (only search users if searchTerm is typed)
      if (searchTerm.trim().length > 0) {
        const users = await apiFetch<User[]>(`/api/users/search?q=${encodeURIComponent(searchTerm)}`);
        setUserResults(users);
      } else {
        setUserResults([]);
      }
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openComments = (post: Post) => {
    setCommentingPost(post);
    setIsCommentsOpen(true);
  };

  const updateCommentsCountInExplore = (postId: string, newCount: number) => {
    setSearchResults(prev => prev.map(p => (p.id === postId ? { ...p, commentsCount: newCount } : p)));
    if (commentingPost && commentingPost.id === postId) {
      setCommentingPost(prev => (prev ? { ...prev, commentsCount: newCount } : null));
    }
  };

  const handlePostDeletedInExplore = (deletedId: string) => {
    setSearchResults(prev => prev.filter(p => p.id !== deletedId));
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex justify-center pb-24 md:pb-8 select-none">
      <div className="w-full max-w-5xl p-4 md:p-8 md:pl-[272px] space-y-8">
        {/* Header Title with Search bar inside */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Compass className="h-5 w-5 text-indigo-400" /> Explore Pulse universe
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Discover trending creators, hashtags, and visual art beats.</p>
          </div>

          {/* Search bar helper */}
          <div className="relative w-full md:w-80">
            <Search className="absolute inset-y-0 left-3.5 h-4 w-4 text-zinc-500 my-auto" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search hashtags (#kyoto) or people..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-11 pr-4 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 placeholder-zinc-500 transition-colors"
            />
          </div>
        </div>

        {/* User Search Results */}
        {userResults.length > 0 && (
          <div className="space-y-3 bg-zinc-950/60 p-5 rounded-2xl border border-zinc-900">
            <h4 className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">Matching Profiles</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {userResults.map(usr => (
                <div
                  key={usr.id}
                  onClick={() => navigate(`/profile/@${usr.username}`)}
                  className="p-3 bg-zinc-900 hover:bg-zinc-850 rounded-xl border border-zinc-800/80 flex items-center gap-3 cursor-pointer transition-all"
                >
                  <img src={usr.avatar} alt={usr.username} className="h-10 w-10 rounded-full border border-zinc-700" />
                  <div className="truncate">
                    <span className="text-xs font-bold text-white block">@{usr.username}</span>
                    <span className="text-[10px] text-zinc-450 truncate block mt-0.5">{usr.fullname}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trending Tags Suggestion bar */}
        {!searchTerm && (
          <div className="flex flex-wrap items-center gap-2 py-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#52525b] mr-2">Trending Tags:</span>
            {['kyoto', 'japan', 'ramen', 'chef_cook', 'zen', 'vibes', 'comfortfood'].map(tag => (
              <button
                key={tag}
                onClick={() => setSearchTerm(`#${tag}`)}
                className="text-xs font-medium px-4 py-2 bg-zinc-950 border border-zinc-850 rounded-full text-zinc-200 hover:border-indigo-500 hover:text-white hover:bg-indigo-950/10 cursor-pointer transition-all"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Bento/Grid Layout Feed */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[...Array(6)].map((__, idx) => (
              <div key={idx} className="aspect-square bg-zinc-950 border border-zinc-900 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-center py-20 bg-zinc-950 border border-zinc-900 rounded-2xl">
            <span className="text-3xl">🌌</span>
            <h4 className="text-sm font-semibold text-zinc-200 mt-2">No results matching query</h4>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">Try typing another hashtag like #kyoto or look up user profiles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            {searchResults.map((post, idx) => {
              // Create interesting Bento pattern layouts by mapping alternate indices to spanning classes!
              const isLargeGridCell = idx % 5 === 0;

              return (
                <div
                  key={post.id}
                  onClick={() => openComments(post)}
                  className={`relative group bg-zinc-900 rounded-2xl overflow-hidden aspect-square border border-zinc-950 transition-all cursor-pointer hover:border-indigo-500/30 ${
                    isLargeGridCell ? 'col-span-1 sm:col-span-2 sm:row-span-1' : ''
                  }`}
                >
                  {isVideoUrl(post.mediaUrls[0]) ? (
                    <video
                      src={post.mediaUrls[0]}
                      muted
                      playsInline
                      className="h-full w-full object-cover group-hover:scale-105 duration-500 transition-transform"
                    />
                  ) : (
                    <img
                      src={post.mediaUrls[0]}
                      alt={post.caption}
                      className="h-full w-full object-cover group-hover:scale-105 duration-500 transition-transform"
                    />
                  )}

                  {/* Dark mask on hover showing counts */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-6 transition-all duration-300">
                    <div className="flex items-center gap-1.5 text-rose-450 font-bold text-xs">
                      <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                      <span>{post.likes ? post.likes.length : 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-200 font-bold text-xs">
                      <MessageCircle className="h-4 w-4" />
                      <span>{post.commentsCount || 0}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `${window.location.origin}/profile/@${post.username}?postId=${post.id}`;
                        navigator.clipboard.writeText(url);
                        showToast('Pulse post link copied to clipboard! 🔗', 'success');
                      }}
                      className="hover:text-indigo-400 text-zinc-400 p-1.5 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
                      title="Share Post Link"
                    >
                      <Share2 className="h-4 w-4 text-zinc-300 hover:text-white" />
                    </button>
                  </div>

                  {/* Top-right icon indicating Carousel post reels */}
                  {post.mediaUrls.length > 1 && (
                    <div className="absolute top-3 right-3 bg-black/60 p-1.5 rounded-lg border border-white/10 z-10">
                      <Grid className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REUSABLE PORTAL COMMENT SHEET */}
      {commentingPost && (
        <CommentsModal
          post={commentingPost}
          isOpen={isCommentsOpen}
          onClose={() => {
            setIsCommentsOpen(false);
            setCommentingPost(null);
          }}
          onCommentCountUpdated={(newCount) => updateCommentsCountInExplore(commentingPost.id, newCount)}
          onPostDeleted={handlePostDeletedInExplore}
        />
      )}
    </div>
  );
}
