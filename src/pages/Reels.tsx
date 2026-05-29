import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { apiFetch } from '../lib/api';
import { Post } from '../types';
import CommentsModal from '../components/CommentsModal';
import { Heart, MessageCircle, Send, Volume2, VolumeX, Grid, Film, Play, Pause } from 'lucide-react';

export default function Reels() {
  const { user, showToast } = useAuth();
  const [searchParams] = useSearchParams();
  const targetReelId = searchParams.get('reelId');

  const [reels, setReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  // Comments modal helper
  const [commentingReel, setCommentingReel] = useState<Post | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  // Playback statuses
  const [isPlaying, setIsPlaying] = useState<Record<string, boolean>>({});

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    loadReels();
  }, []);

  useEffect(() => {
    if (!loading && reels.length > 0 && targetReelId) {
      setTimeout(() => {
        const el = document.getElementById(`reel-card-${targetReelId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    }
  }, [loading, reels, targetReelId]);

  const loadReels = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Post[]>('/api/posts/reels');
      setReels(data);

      const playingStates: Record<string, boolean> = {};
      data.forEach((r, idx) => {
        playingStates[r.id] = idx === 0; // autoplay first reel
      });
      setIsPlaying(playingStates);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // IntersectionObserver to handle autoplay and pausing of Reels in scroll streams
  useEffect(() => {
    if (reels.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const reelId = entry.target.getAttribute('data-reel-id');
          if (!reelId) return;

          const video = videoRefs.current[reelId];
          if (entry.isIntersecting) {
            if (video) {
              video.play().catch(() => {});
              setIsPlaying(prev => ({ ...prev, [reelId]: true }));
            }
          } else {
            if (video) {
              video.pause();
              setIsPlaying(prev => ({ ...prev, [reelId]: false }));
            }
          }
        });
      },
      { threshold: 0.6 } // trigger when 60% of card is in view
    );

    // Register observers
    reels.forEach(r => {
      const el = document.getElementById(`reel-card-${r.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [reels]);

  const handleLikeReel = async (reelId: string) => {
    try {
      const res = await apiFetch<{ liked: boolean; likesCount: number }>(`/api/posts/${reelId}/like`, { method: 'POST' });
      setReels(prev => prev.map(p => {
        if (p.id === reelId) {
          const likesList = [...p.likes];
          if (res.liked) {
            if (!likesList.includes(user!.id)) likesList.push(user!.id);
          } else {
            const idx = likesList.indexOf(user!.id);
            if (idx > -1) likesList.splice(idx, 1);
          }
          return { ...p, likes: likesList };
        }
        return p;
      }));
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const handleTogglePlay = (reelId: string) => {
    const video = videoRefs.current[reelId];
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(prev => ({ ...prev, [reelId]: true }));
    } else {
      video.pause();
      setIsPlaying(prev => ({ ...prev, [reelId]: false }));
    }
  };

  const handleShareReel = (reel: Post) => {
    navigator.clipboard.writeText(`${window.location.origin}/reels`);
    showToast('Reel URL copied to clipboard! 🔗', 'success');
  };

  const openComments = (reel: Post) => {
    setCommentingReel(reel);
    setIsCommentsOpen(true);
  };

  const updateCommentsCountInReels = (reelId: string, newCount: number) => {
    setReels(prev => prev.map(p => (p.id === reelId ? { ...p, commentsCount: newCount } : p)));
    if (commentingReel && commentingReel.id === reelId) {
      setCommentingReel(prev => (prev ? { ...prev, commentsCount: newCount } : null));
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] md:h-screen w-full bg-black text-white flex justify-center select-none overflow-hidden">
      <div className="w-full max-w-sm h-full md:pl-[272px] md:max-w-[calc(384px+272px)] reels-container relative overflow-y-scroll snap-y snap-mandatory no-scrollbar">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 bg-zinc-950">
            <Film className="h-8 w-8 text-indigo-500 animate-spin" />
            <p className="text-xs text-zinc-500 font-mono tracking-widest">LOADING REELS...</p>
          </div>
        ) : reels.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-zinc-950">
            <span className="text-4xl mb-2">🎬</span>
            <h4 className="text-sm font-bold text-zinc-300">No vertical reels found</h4>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-relaxed">
              Become the first Pulse content creator! Publish a custom vertical MP4 reel using the feed sharing modal.
            </p>
          </div>
        ) : (
          reels.map(reel => {
            const isLiked = reel.likes && reel.likes.includes(user?.id || '');
            const isVideoPlaying = !!isPlaying[reel.id];

            return (
              <div
                key={reel.id}
                id={`reel-card-${reel.id}`}
                data-reel-id={reel.id}
                className="w-full h-full min-h-full flex-shrink-0 relative reel-card flex items-center justify-center bg-[#050505] overflow-hidden"
              >
                {/* Main Video Element */}
                <video
                  ref={el => { videoRefs.current[reel.id] = el; }}
                  src={reel.mediaUrls[0]}
                  loop
                  playsInline
                  muted={isMuted}
                  onClick={() => handleTogglePlay(reel.id)}
                  className="w-full h-full object-cover cursor-pointer"
                />

                {/* Floating controls overlays on top */}
                <div className="absolute top-4 right-4 z-15 flex flex-col gap-3">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-3 bg-black/50 hover:bg-black border border-white/5 rounded-full text-white cursor-pointer transition-colors"
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                </div>

                {/* Left Bottom Details panel overlay */}
                <div className="absolute bottom-5 left-4 right-16 z-10 text-white space-y-3.5 pr-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 rounded-xl">
                  {/* Creator avatar card */}
                  <div className="flex items-center gap-2.5">
                    <img src={reel.userAvatar} alt="@username" className="h-8.5 w-8.5 rounded-full border border-zinc-805 object-cover" />
                    <span className="text-xs font-bold font-mono">@{reel.username}</span>
                  </div>

                  {/* Caption details with hashtag coloring */}
                  <p className="text-xs text-zinc-200 leading-relaxed pr-4 line-clamp-3">
                    {reel.caption.split(' ').map((word, wIdx) => {
                      if (word.startsWith('#')) return <strong key={wIdx} className="text-indigo-400 font-medium">{word} </strong>;
                      return word + ' ';
                    })}
                  </p>
                </div>

                {/* Right Interactive Sidebar Action Overlay */}
                <div className="absolute bottom-20 right-4 z-10 flex flex-col items-center gap-5">
                  {/* Like Button */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => handleLikeReel(reel.id)}
                      className="p-3 bg-black/60 hover:bg-black/80 border border-white/5 rounded-full text-white cursor-pointer transition-transform duration-200 active:scale-130 group"
                    >
                      <Heart className={`h-5 w-5 ${isLiked ? 'fill-rose-500 text-rose-500' : 'text-zinc-300'}`} />
                    </button>
                    <span className="text-[10px] font-bold mt-1.5 font-mono text-zinc-350">{reel.likes ? reel.likes.length : 0}</span>
                  </div>

                  {/* Comment trigger */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => openComments(reel)}
                      className="p-3 bg-black/60 hover:bg-black/80 border border-white/5 rounded-full text-white cursor-pointer"
                    >
                      <MessageCircle className="h-5 w-5 text-zinc-300" />
                    </button>
                    <span className="text-[10px] font-bold mt-1.5 font-mono text-zinc-350">{reel.commentsCount || 0}</span>
                  </div>

                  {/* Share button */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => handleShareReel(reel)}
                      className="p-3 bg-black/60 hover:bg-black/80 border border-white/5 rounded-full text-white cursor-pointer"
                    >
                      <Send className="h-5 w-5 text-zinc-350" />
                    </button>
                    <span className="text-[10px] font-medium mt-1 text-zinc-400">Share</span>
                  </div>
                </div>

                {/* Show pausing status indicator icon momentarily */}
                {!isVideoPlaying && (
                  <div className="absolute inset-0 m-auto h-16 w-16 bg-black/60 flex items-center justify-center rounded-full pointer-events-none text-zinc-300 animate-pulse">
                    <Play className="h-6 w-6 ml-1 fill-zinc-300" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* REELS FLOATING COMMENT MODAL */}
      {commentingReel && (
        <CommentsModal
          post={commentingReel}
          isOpen={isCommentsOpen}
          onClose={() => {
            setIsCommentsOpen(false);
            setCommentingReel(null);
          }}
          onCommentCountUpdated={(newCount) => updateCommentsCountInReels(commentingReel.id, newCount)}
          onPostDeleted={(deletedId) => {
            setReels(prev => prev.filter(r => r.id !== deletedId));
          }}
        />
      )}
    </div>
  );
}
