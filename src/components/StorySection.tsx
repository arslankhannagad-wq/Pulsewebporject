import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../lib/api';
import { Story } from '../types';
import { Plus, ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

interface GroupedStories {
  user: {
    id: string;
    username: string;
    avatar: string;
  };
  stories: Story[];
}

export default function StorySection() {
  const { user, showToast } = useAuth();
  const [groupedStories, setGroupedStories] = useState<GroupedStories[]>([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadingState, setUploadingState] = useState(false);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      const data = await apiFetch<GroupedStories[]>('/api/stories');
      setGroupedStories(data);
    } catch (err: any) {
      console.error('Error fetching stories:', err);
    }
  };

  // Automated progress bar tick for stories
  useEffect(() => {
    if (activeGroupIndex !== null) {
      setProgress(0);
      const activeGroup = groupedStories[activeGroupIndex];
      const activeStory = activeGroup.stories[activeStoryIndex];

      // Mark Viewed
      apiFetch(`/api/stories/${activeStory.id}/view`, { method: 'POST' }).catch(() => {});

      if (progressTimer.current) clearInterval(progressTimer.current);

      const intervalTime = 50; // tick every 50ms
      const duration = 4000; // 4s total story viewing
      const increment = (intervalTime / duration) * 100;

      progressTimer.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            handleNextStory();
            return 100;
          }
          return prev + increment;
        });
      }, intervalTime);
    } else {
      if (progressTimer.current) clearInterval(progressTimer.current);
    }

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [activeGroupIndex, activeStoryIndex]);

  const handleNextStory = () => {
    if (activeGroupIndex === null) return;
    const activeGroup = groupedStories[activeGroupIndex];

    if (activeStoryIndex < activeGroup.stories.length - 1) {
      setActiveStoryIndex(prev => prev + 1);
    } else {
      // Transition to next person's story circle index
      if (activeGroupIndex < groupedStories.length - 1) {
        setActiveGroupIndex(activeGroupIndex + 1);
        setActiveStoryIndex(0);
      } else {
        // No more stories, close overlay
        setActiveGroupIndex(null);
      }
    }
  };

  const handlePrevStory = () => {
    if (activeGroupIndex === null) return;

    if (activeStoryIndex > 0) {
      setActiveStoryIndex(prev => prev - 1);
    } else {
      // Transition back to previous person's story circle index
      if (activeGroupIndex > 0) {
        setActiveGroupIndex(activeGroupIndex - 1);
        const prevGroup = groupedStories[activeGroupIndex - 1];
        setActiveStoryIndex(prevGroup.stories.length - 1);
      } else {
        // First user first story, do nothing or reset
        setActiveStoryIndex(0);
      }
    }
  };

  const clickUserCircle = (index: number) => {
    setActiveGroupIndex(index);
    setActiveStoryIndex(0);
  };

  const selectStoryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUploadPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePostStory = async () => {
    if (!uploadPreview) return;
    setUploadingState(true);

    try {
      await apiFetch('/api/stories', {
        method: 'POST',
        body: { mediaUrl: uploadPreview },
      });
      showToast('Story published successfully! ⚡', 'success');
      setUploadPreview(null);
      setIsUploading(false);
      loadStories();
    } catch (err: any) {
      showToast(err.message || 'Story publish failed', 'error');
    } finally {
      setUploadingState(false);
    }
  };

  return (
    <div className="w-full">
      {/* Circle list container */}
      <div className="flex items-center gap-4 py-4 px-2 overflow-x-auto no-scrollbar border-b border-zinc-900 bg-black">
        {/* Your story creator trigger block */}
        <div className="flex flex-col items-center flex-shrink-0 cursor-pointer" onClick={() => setIsUploading(true)}>
          <div className="relative h-15 w-15 rounded-full border border-zinc-700 p-0.5 flex items-center justify-center bg-zinc-950">
            <img src={user?.avatar} alt="You" className="h-full w-full rounded-full object-cover" />
            <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-indigo-600 border border-black flex items-center justify-center">
              <Plus className="h-3 w-3 text-white" />
            </div>
          </div>
          <span className="text-[10px] text-zinc-400 mt-1.5 font-medium">Your Story</span>
        </div>

        {/* Other Story Circle lists */}
        {groupedStories.map((group, idx) => (
          <div
            key={group.user.id}
            onClick={() => clickUserCircle(idx)}
            className="flex flex-col items-center flex-shrink-0 cursor-pointer select-none"
          >
            <div className="h-15 w-15 rounded-full p-0.5 bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-500 flex items-center justify-center">
              <div className="h-full w-full rounded-full bg-black p-0.5 flex items-center justify-center">
                <img src={group.user.avatar} alt={group.user.username} className="h-full w-full rounded-full object-cover" />
              </div>
            </div>
            <span className="text-[10px] text-zinc-300 mt-1.5 truncate max-w-[64px] font-medium">
              @{group.user.username}
            </span>
          </div>
        ))}
      </div>

      {/* STORY ADD MODAL */}
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-zinc-100 font-semibold text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" /> Share a Story
              </h4>
              <button
                onClick={() => {
                  setUploadPreview(null);
                  setIsUploading(false);
                }}
                className="text-zinc-400 hover:text-white text-xs px-2.5 py-1 rounded bg-zinc-900"
              >
                Close
              </button>
            </div>

            {uploadPreview ? (
              <div className="space-y-4">
                <div className="aspect-[9/16] bg-zinc-900 rounded-xl overflow-hidden relative">
                  <img src={uploadPreview} alt="Preview" className="h-full w-full object-cover" />
                </div>
                <button
                  onClick={handlePostStory}
                  disabled={uploadingState}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  {uploadingState ? 'Publishing Story...' : 'Publish to Story Circles'}
                </button>
              </div>
            ) : (
              <div className="text-center py-10 space-y-4">
                <p className="text-xs text-zinc-400">Add a beautiful, ambient photo to your story. Disappears after 24 hours.</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={selectStoryFile}
                  ref={fileInputRef}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800 py-3 px-5 rounded-xl text-xs font-semibold cursor-pointer w-full transition-all"
                >
                  Select Photo Asset
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STORY VIEW PLAYER CAROUSEL */}
      {activeGroupIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
          {/* Main Container */}
          <div className="relative w-full max-w-sm aspect-[9/16] bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            {/* Close */}
            <button
              onClick={() => setActiveGroupIndex(null)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Navigation Chevron Buttons */}
            <button
              onClick={handlePrevStory}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-40 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleNextStory}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-40 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Header / Creator Info */}
            <div className="absolute top-4 left-4 z-40 flex items-center gap-2">
              <img
                src={groupedStories[activeGroupIndex].user.avatar}
                alt={groupedStories[activeGroupIndex].user.username}
                className="h-8 w-8 rounded-full border border-pink-500 object-cover"
              />
              <span className="text-xs text-white font-semibold drop-shadow-md">
                @{groupedStories[activeGroupIndex].user.username}
              </span>
              <span className="text-[10px] text-zinc-300 bg-black/40 px-2 py-0.5 rounded-full font-mono">
                {new Date(groupedStories[activeGroupIndex].stories[activeStoryIndex].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Top Interactive Progress Bars */}
            <div className="absolute top-2 left-4 right-4 z-40 flex gap-1">
              {groupedStories[activeGroupIndex].stories.map((__, idx) => (
                <div key={idx} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-75"
                    style={{
                      width:
                        idx < activeStoryIndex
                          ? '100%'
                          : idx === activeStoryIndex
                          ? `${progress}%`
                          : '0%',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Main Visual Image */}
            <div className="w-full h-full flex items-center justify-center bg-zinc-900 select-none">
              <img
                src={groupedStories[activeGroupIndex].stories[activeStoryIndex].mediaUrl}
                alt="Story content"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
