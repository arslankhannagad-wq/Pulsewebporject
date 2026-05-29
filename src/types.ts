export interface User {
  id: string;
  username: string;
  email: string;
  fullname: string;
  avatar: string;
  bio: string;
  followers: string[]; // User IDs
  following: string[]; // User IDs
  savedPosts: string[]; // Post IDs
  isVerified?: boolean;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  fullname: string;
  userAvatar: string;
  type: 'post' | 'reel';
  mediaUrls: string[];
  caption: string;
  hashtags: string[];
  taggedUsers: string[];
  likes: string[]; // User IDs
  commentsCount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userAvatar: string;
  content: string;
  createdAt: string;
}

export interface Story {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  mediaUrl: string;
  viewers: string[]; // User IDs who viewed it
  createdAt: string;
  expiresAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  mediaUrl?: string;
  emoji?: string;
  seen: boolean;
  createdAt: string;
}

export interface Chat {
  id: string;
  participants: string[]; // User IDs
  lastMessage?: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  receiverId: string;
  senderId: string;
  senderUsername: string;
  senderAvatar: string;
  type: 'like' | 'comment' | 'follow' | 'message';
  postId?: string;
  text: string;
  isSeen: boolean;
  createdAt: string;
}

export interface DashboardAnalytics {
  totalUsers: number;
  totalPosts: number;
  totalReels: number;
  totalStories: number;
  totalMessages: number;
  activeToday: number;
  postsOverTime: { date: string; count: number }[];
  userRolesDistribution: { role: string; count: number }[];
}
