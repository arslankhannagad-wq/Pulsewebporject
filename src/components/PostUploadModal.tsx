import React, { useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch, isVideoUrl } from '../lib/api';
import { Plus, X, Image as ImageIcon, Sparkles, Smile, Video } from 'lucide-react';

interface PostUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export default function PostUploadModal({ isOpen, onClose, onPostCreated }: PostUploadModalProps) {
  const { showToast } = useAuth();
  const [caption, setCaption] = useState('');
  const [type, setType] = useState<'post' | 'reel'>('post');
  const [mediaFiles, setMediaFiles] = useState<string[]>([]); // base64 array
  const [taggedUsers, setTaggedUsers] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const selectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const readPromises = fileList.map((file: File) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readPromises)
      .then(results => {
        setMediaFiles(prev => [...prev, ...results]);
      })
      .catch(err => {
        console.error('File reading failed:', err);
        showToast('Failed to parse some chosen media assets', 'error');
      });
  };

  const clearMediaFile = (idx: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePostPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mediaFiles.length === 0) {
      showToast('At least one media attachment (photo/video) is required.', 'error');
      return;
    }

    setUploading(true);
    try {
      const tagsArray = taggedUsers
        .split(',')
        .map(t => t.replace('@', '').trim().toLowerCase())
        .filter(t => t.length > 0);

      const requestBody = {
        caption,
        type,
        mediaUrls: mediaFiles, // base64 strings array
        taggedUsers: tagsArray,
      };

      await apiFetch('/api/posts', {
        method: 'POST',
        body: requestBody,
      });

      showToast(`Pulse content successfully published! ⚡`, 'success');
      setCaption('');
      setType('post');
      setMediaFiles([]);
      setTaggedUsers('');
      onPostCreated();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error occurred publishing post', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900 bg-zinc-950">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" /> Publish Creative Content
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xs px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handlePostPublish} className="flex-1 p-5 overflow-y-auto max-h-[75vh] space-y-5">
          {/* Post vs Reel switch */}
          <div className="grid grid-cols-2 gap-3 bg-zinc-900 p-1.5 rounded-xl border border-zinc-800/80">
            <button
              type="button"
              onClick={() => setType('post')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                type === 'post' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" /> Post Feed Image
            </button>
            <button
              type="button"
              onClick={() => setType('reel')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                type === 'reel' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Video className="h-3.5 w-3.5" /> Vertical Reel Video
            </button>
          </div>

          {/* Media Selective Grid Preview */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase block">Media Selection</label>
            <div className="grid grid-cols-3 gap-2">
              {mediaFiles.map((media, index) => (
                <div key={index} className="aspect-square bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-800">
                  {isVideoUrl(media) ? (
                    <video src={media} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    <img src={media} alt="Upload piece" className="h-full w-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => clearMediaFile(index)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 hover:bg-black text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Add trigger */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square bg-zinc-900 border-2 border-dashed border-zinc-800/80 rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-white hover:border-indigo-500/50 transition-all cursor-pointer gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span className="text-[10px] font-medium">Add media</span>
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept={type === 'reel' ? 'video/mp4,video/*' : 'image/*,video/*'}
              multiple={type === 'post'}
              onChange={selectFiles}
              className="hidden"
            />
            <p className="text-[10px] text-indigo-400 font-medium">
              * Note: You can select multiple photos and videos for carousel post feed layouts.
            </p>
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase block">Description / Caption</label>
            <textarea
              rows={3}
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="What's going down with your art? Add details, thoughts, #hashtags..."
              className="w-full bg-zinc-900 border border-zinc-800 text-xs rounded-xl p-3.5 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* User Tagging */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase block">Tag Friends (Comma separated)</label>
            <input
              type="text"
              value={taggedUsers}
              onChange={e => setTaggedUsers(e.target.value)}
              placeholder="e.g. traveler_sarah, chef_marco"
              className="w-full bg-zinc-900 border border-zinc-800 text-xs rounded-xl px-3.5 py-2.5 text-zinc-250 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={uploading || mediaFiles.length === 0}
            className="w-full bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white rounded-xl py-3 text-xs font-semibold shadow-xl transition-all cursor-pointer"
          >
            {uploading ? 'Processing content upload...' : 'Launch to Pulse Circle Network ⚡'}
          </button>
        </form>
      </div>
    </div>
  );
}
