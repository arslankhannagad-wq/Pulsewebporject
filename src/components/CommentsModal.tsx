import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { apiFetch } from '../lib/api';
import { Comment, Post } from '../types';
import { Send, Trash } from 'lucide-react';

interface CommentsModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onCommentCountUpdated: (newCount: number) => void;
  onPostDeleted?: (postId: string) => void;
}

export default function CommentsModal({ post, isOpen, onClose, onCommentCountUpdated, onPostDeleted }: CommentsModalProps) {
  const { user, showToast } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen && post.id) {
      loadComments();
    }
    // Reset state on modal open
    setShowConfirmDelete(false);
  }, [isOpen, post.id]);

  const loadComments = async () => {
    try {
      const data = await apiFetch<Comment[]>(`/api/posts/${post.id}/comments`);
      setComments(data);
    } catch (err: any) {
      console.error(err.message);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" id="comments-overlay">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg h-[500px] flex flex-col overflow-hidden shadow-2xl relative">
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
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
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

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900 bg-zinc-950">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Comments <span className="bg-zinc-850 px-2.5 py-0.5 rounded-full text-xs text-zinc-400">{comments.length}</span>
            </h3>
            {(post.userId === user?.id || user?.role === 'admin') && (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="text-[10px] uppercase tracking-wider font-extrabold text-rose-500 hover:text-rose-400 bg-rose-955/20 hover:bg-rose-950/40 px-2 py-1 rounded-md border border-rose-900/30 transition-all flex items-center gap-1 cursor-pointer"
                title="Delete Post"
              >
                <Trash className="h-3.5 w-3.5 text-rose-500" /> Delete Pulse
              </button>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xs px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 transition-colors">
            Close
          </button>
        </div>

        {/* Dynamic List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {comments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs py-10">
              <span className="text-base mb-1">💬</span>
              <span>No comments yet. Start the conversation!</span>
            </div>
          ) : (
            comments.map(com => (
              <div key={com.id} className="flex gap-3 group animate-slide-in">
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
                  <p className="text-xs text-zinc-300 mt-1 pr-6 leading-relaxed">{com.content}</p>
                </div>
                {/* Delete comment action */}
                {(com.userId === user?.id || post.userId === user?.id || user?.role === 'admin') && (
                  <button
                    onClick={() => handleDeleteComment(com.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 p-1.5 rounded transition-all"
                    title="Delete Comment"
                  >
                    <Trash className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Posting Form */}
        <form onSubmit={handlePostComment} className="border-t border-zinc-900 p-4 bg-black flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Write a comment as a Pulse user..."
            className="flex-1 bg-zinc-900 border border-zinc-800 text-xs rounded-xl px-4 py-2.5 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="h-10 w-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors shadow-lg"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
