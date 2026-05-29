import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { apiFetch, isVideoUrl } from '../lib/api';
import { Comment, Post } from '../types';
import { Send, Trash, Heart, MessageCircle, Share2, Bookmark, ChevronLeft, ChevronRight, Award } from 'lucide-react';

interface CommentsModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onCommentCountUpdated: (newCount: number) => void;
  onPostDeleted?: (postId: string) => void;
  onLikeUpdated?: (postId: string, newLikes: string[]) => void;
}

export default function CommentsModal({ post, isOpen, onClose, onCommentCountUpdated, onPostDeleted, onLikeUpdated }: CommentsModalProps) {
  const { user, showToast, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [likes, setLikes] = useState<string[]>(post.likes || []);
  const [likeLoading, setLikeLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen && post.id) {
      loadComments();
      setLikes(post.likes || []);
      setActiveIndex(0);
    }
    setShowConfirmDelete(false);
  }, [isOpen, post.id, post.likes]);

  useEffect(() => {
    if (user && user.savedPosts) {
      setIsSaved(user.savedPosts.includes(post.id));
    }
  }, [user, post.id]);

  const loadComments = async () => {
    try {
      const data = await apiFetch<Comment[]>(`/api/posts/${post.id}/comments`);
      setComments(data);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const handleLikeToggleInModal = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      const res = await apiFetch<{ liked: boolean; likesCount: number }>(`/api/posts/${post.id}/like`, {
        method: 'POST',
      });
      let updatedLikes = [...likes];
      if (res.liked) {
        if (user && !updatedLikes.includes(user.id)) {
          updatedLikes.push(user.id);
        }
      } else {
        if (user) {
          updatedLikes = updatedLikes.filter(id => id !== user.id);
        }
      }
      setLikes(updatedLikes);
      if (onLikeUpdated) {
        onLikeUpdated(post.id, updatedLikes);
      }
      showToast(res.liked ? 'Pulse post liked! ❤️' : 'Pulse post unliked. 💔', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle like', 'error');
    } finally {
      setLikeLoading(false);
    }
  };

  const handleSaveToggleInModal = async () => {
    if (saveLoading) return;
    setSaveLoading(true);
    try {
      const res = await apiFetch<{ saved: boolean; message: string }>(`/api/posts/${post.id}/save`, {
        method: 'POST',
      });
      setIsSaved(res.saved);
      if (refreshUser) {
        await refreshUser();
      }
      showToast(res.message, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle bookmark', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const added = await apiFetch<Comment>(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        body: { content: newComment },
      });
      setComments(prev => [...prev, added]);
      onCommentCountUpdated((post.commentsCount || 0) + 1);
      setNewComment('');
      showToast('Comment posted! 💬', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed comment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      setComments(prev => prev.filter(c => c.id !== commentId));
      onCommentCountUpdated(Math.max(0, (post.commentsCount || 1) - 1));
      showToast('Comment deleted', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete comment', 'error');
    }
  };

  const handleDeletePostInModal = async () => {
    try {
      await apiFetch(`/api/posts/${post.id}`, { method: 'DELETE' });
      showToast('Pulse content deleted successfully', 'info');
      setShowConfirmDelete(false);
      onClose();
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete post', 'error');
    }
  };

  const handleCarouselNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!post.mediaUrls || post.mediaUrls.length <= 1) return;
    setActiveIndex(current => (current < post.mediaUrls.length - 1 ? current + 1 : 0));
  };

  const handleCarouselPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!post.mediaUrls || post.mediaUrls.length <= 1) return;
    setActiveIndex(current => (current > 0 ? current - 1 : post.mediaUrls.length - 1));
  };

  const formatTimestamp = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (!isOpen) return null;

  const hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
  const isVideo = hasMedia && (isVideoUrl(post.mediaUrls[activeIndex]) || post.type === 'reel');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" id="comments-overlay">
      <div className={`bg-zinc-950 border border-zinc-900 rounded-2xl w-full flex flex-col overflow-hidden shadow-2xl relative transition-all ${
        hasMedia 
          ? 'max-w-md md:max-w-4xl h-[90vh] md:h-[620px] lg:h-[660px] md:flex-row' 
          : 'max-w-lg h-[520px]'
      }`}>
        {showConfirmDelete && (
          <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center p-6 text-center space-y-4 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-1">
              <Trash className="h-5 w-5" />
            </div>
            <h3 className="text-zinc-100 font-bold text-sm">Delete Pulse</h3>
            <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
              Are you sure you want to delete this Pulse from your timeline forever? This action cannot be undone.
            </p>
            <div className="flex gap-3 w-full max-w-xs mt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-850 text-zinc-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePostInModal}
                className="flex-1 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Media Side (Left) */}
        {hasMedia && (
          <div className="w-full md:w-3/5 h-[280px] sm:h-[350px] md:h-full bg-black flex items-center justify-center relative overflow-hidden group border-b md:border-b-0 md:border-r border-zinc-900">
            {isVideo ? (
              <video
                src={post.mediaUrls[activeIndex]}
                controls
                loop
                muted
                autoPlay
                playsInline
                className="w-full h-full object-cover select-none"
              />
            ) : (
              <img
                src={post.mediaUrls[activeIndex]}
                alt="Pulse collection slide"
                className="w-full h-full object-cover select-none"
              />
            )}

            {/* Slider Navigation arrows */}
            {post.mediaUrls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handleCarouselPrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black text-white hover:scale-105 transition-all z-10 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCarouselNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black text-white hover:scale-105 transition-all z-10 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                {/* Navigation indicators dots */}
                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-1.5 z-10">
                  {post.mediaUrls.map((_, dIdx) => (
                    <div
                      key={dIdx}
                      className={`h-1.5 rounded-full transition-all ${
                        dIdx === activeIndex ? 'w-4 bg-indigo-505' : 'w-1.5 bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Content Category Indicator Badge */}
            <div className="absolute top-4 left-4 bg-zinc-950/70 backdrop-blur-md px-2.5 py-1 rounded-md border border-zinc-800/80 text-[9px] font-mono uppercase tracking-widest text-indigo-400 z-10">
              {post.type}
            </div>
          </div>
        )}

        {/* Content Column (Right Panel) */}
        <div className="flex-1 h-full flex flex-col overflow-hidden bg-zinc-950">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900 bg-zinc-950 z-10">
            <div className="flex items-center gap-3">
              <img 
                src={post.userAvatar} 
                alt={post.username} 
                onClick={() => {
                  onClose();
                  navigate(`/profile/@${post.username}`);
                }}
                className="h-10 w-10 rounded-full object-cover border border-zinc-850 cursor-pointer" 
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span 
                    onClick={() => {
                      onClose();
                      navigate(`/profile/@${post.username}`);
                    }}
                    className="text-xs font-bold text-zinc-100 hover:underline cursor-pointer"
                  >
                    @{post.username}
                  </span>
                  {post.userId === 'user_pulse_official' && (
                    <Award className="h-3.5 w-3.5 text-indigo-400 fill-indigo-400/20" title="Verified Creator Badge" />
                  )}
                </div>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  {formatTimestamp(post.createdAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(post.userId === user?.id || user?.role === 'admin') && (
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="text-[10px] uppercase tracking-wider font-extrabold text-rose-500 hover:text-rose-450 bg-rose-955/10 hover:bg-rose-950/30 px-2 py-1 rounded-md border border-rose-900/30 transition-all flex items-center gap-1 cursor-pointer"
                  title="Delete Post"
                >
                  <Trash className="h-3.5 w-3.5 text-rose-500" />
                </button>
              )}
              <button 
                onClick={onClose} 
                className="text-zinc-400 hover:text-white text-xs px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>

          {/* Combined Caption and Comments List */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5">
            {/* Caption & Hashtag parsing */}
            <div className="pb-4 border-b border-zinc-900 flex flex-col gap-2.5 bg-zinc-900/15 p-3 rounded-xl">
              <div className="flex items-start gap-2.5">
                <img 
                  src={post.userAvatar} 
                  alt={post.username} 
                  onClick={() => {
                    onClose();
                    navigate(`/profile/@${post.username}`);
                  }}
                  className="h-8 w-8 rounded-full object-cover border border-zinc-805 cursor-pointer mt-0.5" 
                />
                <div className="flex-1">
                  <span 
                    onClick={() => {
                      onClose();
                      navigate(`/profile/@${post.username}`);
                    }}
                    className="text-xs font-bold text-white hover:underline cursor-pointer"
                  >
                    @{post.username}
                  </span>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    {post.caption ? (
                      post.caption.split(' ').map((word, wIdx) => {
                        if (word.startsWith('#')) {
                          return <strong key={wIdx} className="text-indigo-400 hover:underline cursor-pointer">{word} </strong>;
                        }
                        if (word.startsWith('@')) {
                          return <strong key={wIdx} className="text-rose-400 hover:underline cursor-pointer">{word} </strong>;
                        }
                        return word + ' ';
                      })
                    ) : 'No caption provided.'}
                  </p>
                </div>
              </div>
              
              {post.taggedUsers && post.taggedUsers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-zinc-900/50">
                  <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mr-1">Tagged:</span>
                  {post.taggedUsers.map(tag => (
                    <span key={tag} className="text-[10px] text-zinc-400 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-850">
                      @{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Comments discussion */}
            <div className="space-y-4 pt-1">
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-zinc-900 pb-1.5">Comments ({comments.length})</h4>
              {comments.length === 0 ? (
                <div className="h-[140px] flex flex-col items-center justify-center text-zinc-500 text-xs py-5">
                  <span className="text-xl mb-1">💬</span>
                  <span>No comments yet. Start the conversation!</span>
                </div>
              ) : (
                comments.map(com => (
                  <div key={com.id} className="flex gap-2.5 group animate-slide-in">
                    <img 
                      src={com.userAvatar} 
                      alt={com.username} 
                      onClick={() => {
                        onClose();
                        navigate(`/profile/@${com.username}`);
                      }}
                      className="h-8 w-8 rounded-full border border-zinc-800 object-cover cursor-pointer" 
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span 
                          onClick={() => {
                            onClose();
                            navigate(`/profile/@${com.username}`);
                          }}
                          className="text-xs font-semibold text-zinc-200 cursor-pointer hover:underline"
                        >
                          @{com.username}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(com.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1 pr-6 leading-relaxed bg-zinc-900/10 p-2 rounded-xl border border-zinc-900/40">{com.content}</p>
                    </div>
                    {(com.userId === user?.id || post.userId === user?.id || user?.role === 'admin') && (
                      <button
                        onClick={() => handleDeleteComment(com.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-1.5 rounded transition-all cursor-pointer self-start"
                        title="Delete Comment"
                      >
                        <Trash className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sticky Home-Styles Interaction panel */}
          <div className="p-4 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleLikeToggleInModal}
                disabled={likeLoading}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white font-semibold transition-colors cursor-pointer group"
              >
                <Heart className={`h-5 w-5 transition-transform duration-200 active:scale-150 ${user && likes.includes(user.id) ? 'fill-rose-500 text-rose-500 scale-105' : 'text-zinc-450 hover:text-white'}`} />
                <span className={user && likes.includes(user.id) ? 'text-rose-400 font-bold' : 'text-zinc-450'}>
                  {likes.length}
                </span>
              </button>

              <div className="flex items-center gap-1.5 text-xs text-zinc-405 font-semibold">
                <MessageCircle className="h-5 w-5" />
                <span>{comments.length}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/profile/@${post.username}?postId=${post.id}`;
                  navigator.clipboard.writeText(url);
                  showToast('Pulse post link copied to clipboard! 🔗', 'success');
                }}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white font-semibold transition-colors cursor-pointer"
                title="Copy Share Link"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveToggleInModal}
              disabled={saveLoading}
              className="text-zinc-405 hover:text-white transition-colors cursor-pointer"
              title="Save Post"
            >
              <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-indigo-500 text-indigo-500' : 'text-zinc-400'}`} />
            </button>
          </div>

          {/* Write Comments input */}
          <form onSubmit={handlePostComment} className="border-t border-zinc-900 p-4 bg-black flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Write a comment as a Pulse user..."
              className="flex-1 bg-zinc-900/80 border border-zinc-800 text-xs rounded-xl px-4 py-2.5 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-505 focus:bg-zinc-900 transition-colors"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !newComment.trim()}
              className="h-10 w-10 bg-indigo-600 hover:bg-indigo-550 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-indigo-600/15 cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
