import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { apiFetch, isVideoUrl } from '../lib/api';
import { Post } from '../types';
import StorySection from '../components/StorySection';
import SuggestedSideRail from '../components/SuggestedSideRail';
import CommentsModal from '../components/CommentsModal';
import PostUploadModal from '../components/PostUploadModal';
import { Heart, MessageCircle, Bookmark, PlusCircle, MoreHorizontal, Trash, Award, Volume2, UserCheck, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';

export default function Home() {
  const { user, showToast } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals management
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentingPost, setCommentingPost] = useState<Post | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Multi-image active carousel index mapping (postId -> activeIndex)
  const [carouselIndices, setCarouselIndices] = useState<{ [postId: string]: number }>({});

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Post[]>('/api/posts/feed');
      setPosts(data);
    } catch (err: any) {
      console.error('Error fetching feed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const result = await apiFetch<{ liked: boolean; likesCount: number }>(`/api/posts/${postId}/like`, {
        method: 'POST',
      });
      setPosts(prev =>
        prev.map(p => {
          if (p.id === postId) {
            const likesList = [...p.likes];
            if (result.liked) {
              if (!likesList.includes(user!.id)) likesList.push(user!.id);
            } else {
              const idx = likesList.indexOf(user!.id);
              if (idx > -1) likesList.splice(idx, 1);
            }
            return { ...p, likes: likesList };
          }
          return p;
        })
      );
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const [postIdToDelete, setPostIdToDelete] = useState<string | null>(null);

  const handleSavePost = async (postId: string) => {
    try {
      const result = await apiFetch(`/api/posts/${postId}/save`, { method: 'POST' });
      showToast(result.message, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error saving post', 'error');
    }
  };

  const handleDeletePost = (postId: string) => {
    setPostIdToDelete(postId);
  };

  const executeDeletePost = async () => {
    if (!postIdToDelete) return;
    try {
      await apiFetch(`/api/posts/${postIdToDelete}`, { method: 'DELETE' });
      setPosts(prev => prev.filter(p => p.id !== postIdToDelete));
      showToast('Pulse content deleted successfully', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete piece', 'error');
    } finally {
      setPostIdToDelete(null);
    }
  };

  const openComments = (post: Post) => {
    setCommentingPost(post);
    setIsCommentsOpen(true);
  };

  const updateCommentsCount = (postId: string, newCount: number) => {
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, commentsCount: newCount } : p)));
    if (commentingPost && commentingPost.id === postId) {
      setCommentingPost(prev => (prev ? { ...prev, commentsCount: newCount } : null));
    }
  };

  const handleCarouselNext = (postId: string, maxItems: number) => {
    setCarouselIndices(prev => {
      const current = prev[postId] || 0;
      return {
        ...prev,
        [postId]: current < maxItems - 1 ? current + 1 : 0,
      };
    });
  };

  const handleCarouselPrev = (postId: string, maxItems: number) => {
    setCarouselIndices(prev => {
      const current = prev[postId] || 0;
      return {
        ...prev,
        [postId]: current > 0 ? current - 1 : maxItems - 1,
      };
    });
  };

  // Convert post timestamp cleanly
  const formatTimestamp = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen bg-black text-zinc-150 flex justify-center pb-24 md:pb-0 select-none">
      {/* Central content frame */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-8 p-4 md:p-8 md:pl-[272px]">
        {/* Main Feed panel */}
        <main className="lg:col-span-2 min-w-0 space-y-6">
          {/* Stories bar components wrapper */}
          <StorySection />

          {/* Quick Creator Box trigger */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-3">
              <img src={user?.avatar} alt="Me" className="h-10 w-10 rounded-full border border-zinc-800" />
              <button
                onClick={() => setIsUploadOpen(true)}
                className="text-xs text-zinc-500 hover:text-zinc-300 text-left cursor-pointer"
              >
                What is breathing in your mind, {user?.fullname.split(' ')[0]}? Keep the beat going...
              </button>
            </div>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="px-4 py-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            >
              <PlusCircle className="h-4 w-4" /> Share Post
            </button>
          </div>

          {/* Feeds stream */}
          {loading ? (
            <div className="space-y-6 pt-4">
              {[...Array(2)].map((_, index) => (
                <div key={index} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-zinc-850 rounded-full" />
                    <div className="space-y-2">
                      <div className="h-3.5 w-24 bg-zinc-850 rounded" />
                      <div className="h-3 w-12 bg-zinc-850 rounded" />
                    </div>
                  </div>
                  <div className="h-[300px] w-full bg-zinc-850 rounded-xl" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-zinc-950 border border-zinc-900 p-12 text-center rounded-2xl">
              <span className="text-3xl mb-2 block">🌌</span>
              <h4 className="text-sm font-semibold text-zinc-200">Your feed is completely silent</h4>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-normal">
                Follow suggestion accounts on the right rail or publish your first artistic creations to get Pulse alive.
              </p>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="mx-auto mt-4 px-4 py-2 bg-indigo-650 text-white rounded-xl text-xs font-semibold block cursor-pointer hover:bg-indigo-500 transition-colors"
              >
                Share First Post
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {posts.map(post => {
                const activeIndex = carouselIndices[post.id] || 0;
                const isLikedByMe = post.likes && post.likes.includes(user?.id || '');

                return (
                  <article key={post.id} className="bg-zinc-950 border border-zinc-900/80 rounded-2xl overflow-hidden shadow-2xl animate-slide-in">
                    {/* Author Head info */}
                    <div className="p-4 flex items-center justify-between border-b border-zinc-950 bg-zinc-950">
                      <div className="flex items-center gap-3">
                        <img 
                          src={post.userAvatar} 
                          alt={post.username} 
                          onClick={() => navigate(`/profile/@${post.username}`)}
                          className="h-10 w-10 rounded-full object-cover border border-zinc-850 cursor-pointer" 
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span 
                              onClick={() => navigate(`/profile/@${post.username}`)}
                              className="text-xs font-bold text-zinc-100 hover:underline cursor-pointer"
                            >
                              @{post.username}
                            </span>
                            {/* Verification badge trigger */}
                            {post.userId === 'user_pulse_official' && (
                              <Award className="h-3.5 w-3.5 text-indigo-400 fill-indigo-400/20" title="Verified Creator Badge" />
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500 block mt-0.5">
                            {formatTimestamp(post.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* delete options context */}
                      {(post.userId === user?.id || user?.role === 'admin') && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-zinc-500 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-950/10 transition-all cursor-pointer"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Carousel image media block */}
                    <div className="relative w-full aspect-square bg-zinc-900 overflow-hidden flex items-center justify-center">
                      {isVideoUrl(post.mediaUrls[activeIndex]) ? (
                        <video
                          src={post.mediaUrls[activeIndex]}
                          controls
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover select-none"
                        />
                      ) : (
                        <img
                          src={post.mediaUrls[activeIndex]}
                          alt="Content item"
                          className="w-full h-full object-cover select-none"
                        />
                      )}

                      {/* Side chevrons helpers for carousels */}
                      {post.mediaUrls.length > 1 && (
                        <>
                          <button
                            onClick={() => handleCarouselPrev(post.id, post.mediaUrls.length)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black text-white"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleCarouselNext(post.id, post.mediaUrls.length)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black text-white"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>

                          {/* Dots positioning indicators */}
                          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-1.5">
                            {post.mediaUrls.map((_, dotIdx) => (
                              <div
                                key={dotIdx}
                                className={`h-1.5 rounded-full transition-all ${
                                  dotIdx === activeIndex ? 'w-4 bg-indigo-500' : 'w-1.5 bg-white/40'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Action buttons list */}
                    <div className="p-4 pb-2 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleLikePost(post.id)}
                          className={`flex items-center gap-1.5 text-xs font-semibold select-none group focus:outline-none cursor-pointer`}
                        >
                          <Heart
                            className={`h-[22px] w-[22px] transition-transform duration-200 active:scale-150 ${
                              isLikedByMe ? 'fill-rose-500 text-rose-500 scale-105' : 'text-zinc-400 hover:text-white'
                            }`}
                          />
                          <span className={`${isLikedByMe ? 'text-rose-400 font-bold' : 'text-zinc-450'}`}>
                            {post.likes ? post.likes.length : 0}
                          </span>
                        </button>

                        <button
                          onClick={() => openComments(post)}
                          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white font-semibold cursor-pointer"
                        >
                          <MessageCircle className="h-[22px] w-[22px]" />
                          <span>{post.commentsCount || 0}</span>
                        </button>

                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/profile/@${post.username}?postId=${post.id}`;
                            navigator.clipboard.writeText(url);
                            showToast('Pulse post link copied to clipboard! 🔗', 'success');
                          }}
                          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white font-semibold cursor-pointer"
                          title="Share Post"
                        >
                          <Share2 className="h-[21px] w-[21px]" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleSavePost(post.id)}
                        className="text-zinc-400 hover:text-white cursor-pointer"
                      >
                        <Bookmark className="h-[22px] w-[22px]" />
                      </button>
                    </div>

                    {/* Caption description block */}
                    <div className="px-5 pb-5 pt-1 space-y-1">
                      <p className="text-xs text-zinc-200 leading-relaxed">
                        <span 
                          onClick={() => navigate(`/profile/@${post.username}`)}
                          className="font-bold text-zinc-100 mr-2 cursor-pointer hover:underline"
                        >
                          @{post.username}
                        </span>
                        {/* Dynamic hashtag text highlighting logic matching React layout requirements. */}
                        {post.caption ? (
                          post.caption.split(' ').map((word, wIdx) => {
                            if (word.startsWith('#')) {
                              return <strong key={wIdx} className="text-indigo-400 cursor-pointer hover:underline">{word} </strong>;
                            }
                            if (word.startsWith('@')) {
                              return <strong key={wIdx} className="text-rose-400 cursor-pointer hover:underline">{word} </strong>;
                            }
                            return word + ' ';
                          })
                        ) : null}
                      </p>

                      {/* Tagged users badge helpers */}
                      {post.taggedUsers && post.taggedUsers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mr-1">Tagged:</span>
                          {post.taggedUsers.map(tag => (
                            <span key={tag} className="text-[10px] text-zinc-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                              @{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        {/* Suggested creators rail - right side on desktop layouts */}
        <div className="hidden lg:block">
          <SuggestedSideRail />
        </div>
      </div>

      {/* COMMENTS POPUP OVERLAY PORTAL */}
      {commentingPost && (
        <CommentsModal
          post={commentingPost}
          isOpen={isCommentsOpen}
          onClose={() => {
            setIsCommentsOpen(false);
            setCommentingPost(null);
          }}
          onCommentCountUpdated={(newCount) => updateCommentsCount(commentingPost.id, newCount)}
          onPostDeleted={(deletedId) => {
            setPosts(prev => prev.filter(p => p.id !== deletedId));
          }}
        />
      )}

      {/* POST LAUNCH MODAL */}
      <PostUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onPostCreated={loadFeed}
      />

      {/* CUSTOM FLOATING CONFIRM DELETE MODAL */}
      {postIdToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
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
                onClick={executeDeletePost}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
