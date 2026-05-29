import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../components/AuthContext';
import { apiFetch } from '../lib/api';
import { Message, Chat, User } from '../types';
import { Send, Image as ImageIcon, Smile, MessageSquare, Phone, Video, Search, ChevronLeft, ArrowDown, ShieldAlert } from 'lucide-react';

export default function Messages() {
  const { user, socket, showToast } = useAuth();
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState<Record<string, boolean>>({});

  // File uploads
  const [fileAttachment, setFileAttachment] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search/Start conversation modal helper
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeChatRef = useRef<string | null>(null);

  useEffect(() => {
    activeChatRef.current = activeChatId;
    if (activeChatId) {
      loadMessages(activeChatId);
      markChatAsSeen(activeChatId);
    }
  }, [activeChatId]);

  useEffect(() => {
    loadChatRooms();

    // Register real-time incoming actions via socket
    if (socket) {
      socket.on('message-received', (msg: Message) => {
        // If message is from the active conversation thread, append immediately
        if (msg.chatId === activeChatRef.current) {
          setMessages(prev => [...prev, msg]);
          markChatAsSeen(msg.chatId);
          setTimeout(scrollToBottom, 100);
        }
        loadChatRooms(); // refresh sidebar list order and unread statuses
      });

      socket.on('typing-received', ({ chatId, isTyping: isPeerTyping }: any) => {
        setPeerTyping(prev => ({
          ...prev,
          [chatId]: isPeerTyping,
        }));
      });
    }

    return () => {
      if (socket) {
        socket.off('message-received');
        socket.off('typing-received');
      }
    };
  }, [socket]);

  const loadChatRooms = async () => {
    try {
      const data = await apiFetch<any[]>('/api/chats');
      setChatRooms(data);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const loadMessages = async (chatId: string) => {
    try {
      const msgs = await apiFetch<Message[]>(`/api/chats/${chatId}/messages`);
      setMessages(msgs);
      setTimeout(scrollToBottom, 150);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const markChatAsSeen = (chatId: string) => {
    apiFetch(`/api/chats/${chatId}/seen`, { method: 'POST' })
      .then(() => loadChatRooms())
      .catch(console.error);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() && !fileAttachment) return;
    if (!activeChatId) return;

    try {
      const sent = await apiFetch<Message>(`/api/chats/${activeChatId}/messages`, {
        method: 'POST',
        body: {
          text: newMessageText,
          mediaUrl: fileAttachment || undefined,
        },
      });

      setMessages(prev => [...prev, sent]);
      setNewMessageText('');
      setFileAttachment(null);
      setTimeout(scrollToBottom, 100);

      // Emit socket typing stops
      if (socket) {
        socket.emit('typing', { chatId: activeChatId, senderId: user!.id, isTyping: false });
        setIsTyping(false);
      }

      loadChatRooms();
    } catch (err: any) {
      showToast(err.message || 'Error details missing in chat sending', 'error');
    }
  };

  const handleTyping = (textVal: string) => {
    setNewMessageText(textVal);
    if (!socket || !activeChatId) return;

    if (textVal.length > 0 && !isTyping) {
      socket.emit('typing', { chatId: activeChatId, senderId: user!.id, isTyping: true });
      setIsTyping(true);
    } else if (textVal.length === 0 && isTyping) {
      socket.emit('typing', { chatId: activeChatId, senderId: user!.id, isTyping: false });
      setIsTyping(false);
    }
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFileAttachment(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const triggerUserSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    try {
      const matching = await apiFetch<User[]>(`/api/users/search?q=${encodeURIComponent(val)}`);
      // exclude self
      setSearchResults(matching.filter(u => u.id !== user?.id));
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const startConversationWithUser = async (targetId: string) => {
    try {
      const room = await apiFetch<Chat>('/api/chats', {
        method: 'POST',
        body: { recipientId: targetId },
      });
      setIsSearching(false);
      setSearchQuery('');
      setSearchResults([]);
      loadChatRooms();
      setActiveChatId(room.id);
    } catch (err: any) {
      showToast(err.message || 'Error launching messaging session', 'error');
    }
  };

  const activeChatObj = chatRooms.find(c => c.id === activeChatId);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex md:pl-[264px] pb-16 md:pb-0 select-none">
      <div className="w-full flex h-screen overflow-hidden">
        {/* Left conversations Side drawer panel */}
        <section className={`w-full md:w-85 border-r border-zinc-900 bg-black flex flex-col ${
          activeChatId ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header */}
          <div className="p-5 border-b border-zinc-900 flex justify-between items-center bg-zinc-950">
            <h2 className="text-base font-bold font-mono text-zinc-100">Direct Messages</h2>
            <button
              onClick={() => setIsSearching(true)}
              className="px-3 py-1.5 bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-650 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Compose +
            </button>
          </div>

          {/* search bar for messages */}
          <div className="p-4 border-b border-zinc-950">
            <div className="relative">
              <Search className="absolute inset-y-0 left-3 h-3.5 w-3.5 text-zinc-500 my-auto" />
              <input
                type="text"
                placeholder="Lookup active direct threats..."
                onFocus={() => setIsSearching(true)}
                className="w-full bg-zinc-900 border border-zinc-805 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-indigo-500/55"
              />
            </div>
          </div>

          {/* Chats rooms array */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-950/40">
            {chatRooms.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 text-xs">
                <MessageSquare className="h-6 w-6 text-zinc-700 mb-2" />
                <span>No active timelines found. Start composing!</span>
              </div>
            ) : (
              chatRooms.map(room => {
                const isSelected = room.id === activeChatId;
                const isUnseen = room.lastMessageSenderId !== user?.id && !room.lastMessageSeen;

                return (
                  <div
                    key={room.id}
                    onClick={() => setActiveChatId(room.id)}
                    className={`flex items-center justify-between p-4 cursor-pointer transition-all ${
                      isSelected ? 'bg-zinc-900 border-l-4 border-indigo-500' : 'hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="relative">
                        <img src={room.recipient.avatar} alt="Recipient" className="h-10 w-10 rounded-full border border-zinc-800" />
                        {room.recipient.isOnline && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-500 border-2 border-black rounded-full" />
                        )}
                      </div>
                      <div className="truncate">
                        <span className={`text-xs block ${isUnseen ? 'text-white font-bold' : 'text-zinc-350'}`}>
                          @{room.recipient.username}
                        </span>
                        <span className={`text-[10px] truncate block ${isUnseen ? 'text-indigo-400 font-semibold' : 'text-zinc-500'}`}>
                          {room.lastMessage}
                        </span>
                      </div>
                    </div>

                    {isUnseen && (
                      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Active Conversation Stream Frame */}
        <section className={`flex-1 flex flex-col bg-[#070709] h-full ${
          !activeChatId ? 'hidden md:flex items-center justify-center p-8' : 'flex'
        }`}>
          {activeChatId && activeChatObj ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-zinc-900 bg-zinc-950 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveChatId(null)}
                    className="md:hidden p-1 bg-zinc-900 rounded-lg text-zinc-400 hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <img src={activeChatObj.recipient.avatar} alt="Peer" className="h-9 w-9 rounded-full border border-zinc-800" />
                  <div>
                    <h3 className="text-xs font-bold text-white">@{activeChatObj.recipient.username}</h3>
                    <span className="text-[9px] flex items-center gap-1.5 mt-0.5">
                      {activeChatObj.recipient.isOnline ? (
                        <>
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span className="text-emerald-400 font-medium">Online status active</span>
                        </>
                      ) : (
                        <>
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-650" />
                          <span className="text-zinc-500 font-medium">Offline</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Call simulation icons */}
                <div className="flex items-center gap-3 text-zinc-500">
                  <button onClick={() => showToast('Voice call functions are simulated 📞', 'info')} className="hover:text-white p-2 text-xs">
                    <Phone className="h-4 w-4" />
                  </button>
                  <button onClick={() => showToast('Video feed streaming functions are simulated 🎬', 'info')} className="hover:text-white p-2">
                    <Video className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Messages Lists Stream Grid */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-black/30">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs py-10">
                    <MessageSquare className="h-8 w-8 text-zinc-800 mb-2" />
                    <span>No chat logs. Wave hi to @{activeChatObj.recipient.username}! 👋</span>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isSelf = msg.senderId === user?.id;

                    return (
                      <div key={msg.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'} animate-slide-in`}>
                        <div className={`max-w-[70%] space-y-1.5 ${isSelf ? 'items-end' : 'items-start'}`}>
                          <div className={`rounded-2xl px-4 py-3 text-xs leading-normal ${
                            isSelf
                              ? 'bg-indigo-650 text-white rounded-br-none shadow-xl'
                              : 'bg-zinc-900 text-zinc-200 rounded-bl-none border border-zinc-805/80'
                          }`}>
                            {/* Message Image Attachment support */}
                            {msg.mediaUrl && (
                              <div className="rounded-lg overflow-hidden mb-2 max-w-sm border border-black/30">
                                <img src={msg.mediaUrl} alt="Attachments" className="object-cover h-40 w-full" />
                              </div>
                            )}
                            <p className="break-all whitespace-pre-wrap">{msg.text}</p>
                          </div>
                          <span className="text-[8px] text-zinc-500 font-mono block px-1">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Peer Typing Indicator */}
                {peerTyping[activeChatId] && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-900 border border-zinc-805 text-[10px] text-zinc-400 rounded-full px-4 py-2 flex items-center gap-1.5 animate-pulse">
                      <span className="h-1.5 w-1.5 bg-zinc-500 rounded-full animate-bounce delay-100" />
                      <span className="h-1.5 w-1.5 bg-zinc-500 rounded-full animate-bounce delay-200" />
                      <span className="h-1.5 w-1.5 bg-zinc-500 rounded-full animate-bounce delay-300" />
                      <span>@{activeChatObj.recipient.username} is typing...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message inputs form footer */}
              <form onSubmit={handleSendMessage} className="border-t border-zinc-900/80 p-4 bg-zinc-950 flex flex-col gap-2 relative">
                {/* File Attachment previews layout */}
                {fileAttachment && (
                  <div className="absolute top-[-92px] left-4 bg-zinc-905 border border-zinc-800 p-1.5 rounded-xl shadow-2xl flex items-center gap-2">
                    <img src={fileAttachment} alt="Attachment preview" className="h-14 w-14 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setFileAttachment(null)}
                      className="text-xs font-mono font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 p-1 rounded"
                    >
                      Delete
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>

                  <input
                    type="text"
                    value={newMessageText}
                    onChange={e => handleTyping(e.target.value)}
                    placeholder={`Compose direct message inside Pulse secure thread...`}
                    className="flex-1 bg-zinc-900 border border-zinc-805 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-indigo-500/80 text-zinc-200"
                  />

                  {/* Quick Send */}
                  <button
                    type="submit"
                    disabled={!newMessageText.trim() && !fileAttachment}
                    className="h-11 w-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-650/30 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="h-4.5 w-4.5" />
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleSelectFile}
                  className="hidden"
                />
              </form>
            </>
          ) : (
            <div className="text-center space-y-3 p-8">
              <span className="text-4xl block">💬</span>
              <h3 className="text-sm font-bold text-zinc-300">Pulse Private Encrypted Rooms</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                Connect and swap high-fidelity artwork details back and forth with other creators in real-time.
              </p>
              <button
                onClick={() => setIsSearching(true)}
                className="mx-auto px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Compose New Message
              </button>
            </div>
          )}
        </section>
      </div>

      {/* SEARCH/START CONVO POPUP */}
      {isSearching && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
              <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Start Convo Group</h3>
              <button onClick={() => { setIsSearching(false); setSearchQuery(''); setSearchResults([]); }} className="text-xs text-zinc-500 hover:text-white px-2 py-1.5 rounded bg-zinc-900">
                Cancel
              </button>
            </div>

            {/* Input Search */}
            <div className="relative">
              <Search className="absolute inset-y-0 left-3 h-3.5 w-3.5 my-auto text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => triggerUserSearch(e.target.value)}
                placeholder="Find creator by name or username..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-9 pr-3 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* list matching search */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-[11px] italic">
                  Typing keyword to query accounts list...
                </div>
              ) : (
                searchResults.map(match => (
                  <div
                    key={match.id}
                    onClick={() => startConversationWithUser(match.id)}
                    className="p-3 bg-zinc-900 hover:bg-zinc-850 rounded-xl border border-zinc-800 flex items-center gap-3 cursor-pointer transition-colors"
                  >
                    <img src={match.avatar} alt="Avatar Match" className="h-8 w-8 rounded-full object-cover" />
                    <div className="text-left font-sans">
                      <span className="text-xs font-semibold text-zinc-100 block">@{match.username}</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">{match.fullname}</span>
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
