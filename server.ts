import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { db, connectDB } from './server/db';
import { User, Post, Comment, Story, Message, Chat, Notification, DashboardAnalytics } from './src/types';

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'pulse_secret_key_1337_jwt';

// Ensure Uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'data/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    username: string;
    role: 'admin' | 'user';
  };
}

// Base64 helper to store raw uploads into physical files
function saveBase64File(dataUrl: string, prefix = 'file'): string {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl; // return if already URL or plain text
  }
  try {
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return dataUrl;
    }
    const ext = matches[1].split('/')[1] || 'png';
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Failed to save base64 file:', err);
    return dataUrl;
  }
}

// Clean up old stories (> 24 hours older)
async function cleanExpiredStories() {
  try {
    const stories = await db.stories.find();
    if (!stories) return;
    const now = new Date();
    for (const story of stories) {
      if (new Date(story.expiresAt) < now) {
        await db.stories.deleteOne({ id: story.id });
      }
    }
  } catch (error) {
    console.error('Error cleaning expired stories:', error);
  }
}
setInterval(cleanExpiredStories, 60 * 60 * 1000); // Check every hour

async function initServer() {
  await connectDB();
  const app = express();
  const server = http.createServer(app);

  // Configure Socket.io
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Track socket connections
  const activeSockets = new Map<string, string>(); // socketId -> userId
  const userOnlineStatus = new Map<string, string>(); // userId -> 'online' | 'offline'

  // Seed DB with mock users and posts if totally empty
  const usersCount = await db.users.count();
  if (usersCount === 0) {
    console.log('Database empty! Seeding default high-fidelity metadata & postings...');

    // Hash passwords for seed accounts
    const testPassword = await bcryptjs.hash('password123', 10);

    const seedUsersData: User[] = [
      {
        id: 'user_pulse_official',
        username: 'pulse',
        email: 'info@pulse.app',
        fullname: 'Pulse Official',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop',
        bio: 'The beat of social discovery. Experience Pulse – a modern dark social network for creators. ⚡',
        followers: ['user_sarah', 'user_marco'],
        following: ['user_sarah'],
        savedPosts: [],
        isVerified: true,
        role: 'admin',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user_sarah',
        username: 'traveler_sarah',
        email: 'sarah@travel.com',
        fullname: 'Sarah Jenkins',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
        bio: 'Wanderlust explorer. Currently capturing the alleys of Kyoto, Japan. 🗺️📸',
        followers: ['user_pulse_official', 'user_marco'],
        following: ['user_pulse_official', 'user_marco'],
        savedPosts: [],
        isVerified: true,
        role: 'user',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user_marco',
        username: 'chef_marco',
        email: 'marco@kitchen.com',
        fullname: 'Marco Rossi',
        avatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&h=150&fit=crop',
        bio: 'Searing up artisanal flavors since 2018. Cooking with fire! 🔥🍝',
        followers: ['user_sarah'],
        following: ['user_pulse_official', 'user_sarah'],
        savedPosts: [],
        isVerified: false,
        role: 'user',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user_admin',
        username: 'admin',
        email: 'admin@pulse.app',
        fullname: 'Pulse Admin Staff',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
        bio: 'Administration and safety enforcement team.',
        followers: [],
        following: [],
        savedPosts: [],
        isVerified: true,
        role: 'admin',
        createdAt: new Date().toISOString()
      }
    ];

    // Save users directly
    for (const u of seedUsersData) {
      const uWithAuth = { ...u, password: testPassword };
      await db.users.insertOne(uWithAuth as any);
    }

    // Seed Posts & Reels
    const seedPosts: Post[] = [
      {
        id: 'post_kyoto_alley',
        userId: 'user_sarah',
        username: 'traveler_sarah',
        fullname: 'Sarah Jenkins',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
        type: 'post',
        mediaUrls: [
          'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&fit=crop',
          'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&fit=crop'
        ],
        caption: 'Chasing sunsets through the historic streets of Kyoto. Unbelievable details around every corner! 🎋⛩️ #kyoto #japan #traveler #vibes',
        hashtags: ['kyoto', 'japan', 'traveler', 'vibes'],
        taggedUsers: ['pulse'],
        likes: ['user_pulse_official', 'user_marco'],
        commentsCount: 2,
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
      },
      {
        id: 'post_ramen_bowl',
        userId: 'user_marco',
        username: 'chef_marco',
        fullname: 'Marco Rossi',
        userAvatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&h=150&fit=crop',
        type: 'post',
        mediaUrls: [
          'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&fit=crop'
        ],
        caption: 'Signature 36-hour spicy tonkotsu broth, hand-rolled noodles, and slow-braised chashu. Perfect recipe for rainy Mondays! 🍜🔥 #chef_cook #ramen #comfortfood',
        hashtags: ['chef_cook', 'ramen', 'comfortfood'],
        taggedUsers: ['traveler_sarah'],
        likes: ['user_sarah'],
        commentsCount: 1,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'reel_cooking',
        userId: 'user_marco',
        username: 'chef_marco',
        fullname: 'Marco Rossi',
        userAvatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&h=150&fit=crop',
        type: 'reel',
        mediaUrls: [
          'https://assets.mixkit.co/videos/preview/mixkit-kitchen-chef-preparing-a-fresh-vegetable-salad-41484-large.mp4'
        ],
        caption: 'Art of salad plating. Crisp greens, zesty orange glaze, and sunflower seeds. Let organic cooking set your mood! 🌱🥗 #chefskills #reels #healthy',
        hashtags: ['chefskills', 'reels', 'healthy'],
        taggedUsers: [],
        likes: ['user_pulse_official', 'user_sarah'],
        commentsCount: 1,
        createdAt: new Date(Date.now() - 12 * 3600000).toISOString()
      },
      {
        id: 'reel_sunset_kyoto',
        userId: 'user_sarah',
        username: 'traveler_sarah',
        fullname: 'Sarah Jenkins',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
        type: 'reel',
        mediaUrls: [
          'https://assets.mixkit.co/videos/preview/mixkit-waterfall-in-forest-2213-large.mp4'
        ],
        caption: 'A secret waterfall hidden deep in the hills of Honshu. Listen to that gentle rhythm. 🌲🍃✨ #zen #waterfall #reels #hike',
        hashtags: ['zen', 'waterfall', 'reels', 'hike'],
        taggedUsers: [],
        likes: ['user_marco'],
        commentsCount: 1,
        createdAt: new Date(Date.now() - 5 * 3600000).toISOString()
      }
    ];

    for (const post of seedPosts) {
      await db.posts.insertOne(post);
    }

    // Seed comments
    const seedComments: Comment[] = [
      {
        id: 'comment_1',
        postId: 'post_kyoto_alley',
        userId: 'user_pulse_official',
        username: 'pulse',
        userAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop',
        content: 'This image capture defines tranquility. Keep the adventure coming!',
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        id: 'comment_2',
        postId: 'post_kyoto_alley',
        userId: 'user_marco',
        username: 'chef_marco',
        userAvatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&h=150&fit=crop',
        content: 'Absolutely beautiful! Did you try the hand-rolled noodles there?',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'comment_3',
        postId: 'post_ramen_bowl',
        userId: 'user_sarah',
        username: 'traveler_sarah',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
        content: 'Oh this looks to die for! I need the address ASAP. 🤤🍜',
        createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString()
      },
      {
        id: 'comment_reel_1',
        postId: 'reel_cooking',
        userId: 'user_sarah',
        username: 'traveler_sarah',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
        content: 'Plating is absolute masterclass, Marco!',
        createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
      },
      {
        id: 'comment_reel_2',
        postId: 'reel_sunset_kyoto',
        userId: 'user_marco',
        username: 'chef_marco',
        userAvatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&h=150&fit=crop',
        content: 'So refreshing to look at. Incredible spot!',
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
      }
    ];

    for (const comment of seedComments) {
      await db.comments.insertOne(comment);
    }

    // Seed active stories (24h)
    const seedStories: Story[] = [
      {
        id: 'story1',
        userId: 'user_sarah',
        username: 'traveler_sarah',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
        mediaUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600&fit=crop',
        viewers: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString()
      },
      {
        id: 'story2',
        userId: 'user_marco',
        username: 'chef_marco',
        userAvatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&h=150&fit=crop',
        mediaUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&fit=crop',
        viewers: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString()
      }
    ];

    for (const story of seedStories) {
      await db.stories.insertOne(story);
    }
  }

  // Set up Express Middlewares
  app.use(cors({
    origin: '*',
    credentials: true,
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  // Static directory serving
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Authentication custom middleware
  function authenticateToken(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): void {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Access token left out.' });
      return;
    }

    jwt.verify(token, JWT_SECRET, (err: any, tokenPayload: any) => {
      if (err) {
        res.status(403).json({ error: 'Token invalid or expired.' });
        return;
      }
      req.user = tokenPayload;
      next();
    });
  }

  // --- AUTH & USER API ROUTES ---

  // Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password, fullname } = req.body;
      if (!username || !email || !password || !fullname) {
        res.status(400).json({ error: 'All fields are strictly required.' });
        return;
      }

      // Check existing users
      const lowerUsername = username.toLowerCase().trim();
      const lowerEmail = email.toLowerCase().trim();

      const existingUser = await db.users.findOne({ username: lowerUsername });
      if (existingUser) {
        res.status(400).json({ error: 'Username is already taken' });
        return;
      }

      const existingEmail = await db.users.findOne({ email: lowerEmail });
      if (existingEmail) {
        res.status(400).json({ error: 'Email has already been registered' });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(lowerEmail)) {
        res.status(400).json({ error: 'Invalid email address provided' });
        return;
      }

      // Hash password
      const hashedPassword = await bcryptjs.hash(password, 10);

      const userId = 'user_' + Math.random().toString(36).substring(2, 11);
      const newUser: User = {
        id: userId,
        username: lowerUsername,
        email: lowerEmail,
        fullname: fullname.trim(),
        avatar: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${lowerUsername}`,
        bio: 'Welcome to my Pulse profile! ⚡',
        followers: [],
        following: [],
        savedPosts: [],
        role: 'user',
        createdAt: new Date().toISOString()
      };

      await db.users.insertOne({ ...newUser, password: hashedPassword } as any);

      // Create authentication token
      const token = jwt.sign(
        { id: newUser.id, username: newUser.username, role: newUser.role },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(201).json({ user: newUser, token });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Registration failed' });
    }
  });

  // Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { usernameOrEmail, password } = req.body;
      if (!usernameOrEmail || !password) {
        res.status(400).json({ error: 'Username/Email and Password are required.' });
        return;
      }

      const searchKey = usernameOrEmail.toLowerCase().trim();
      let foundUser: any = await db.users.findOne({ username: searchKey });
      if (!foundUser) {
        foundUser = await db.users.findOne({ email: searchKey });
      }

      if (!foundUser) {
        res.status(400).json({ error: 'Invalid credentials provided.' });
        return;
      }

      const isMatch = await bcryptjs.compare(password, foundUser.password);
      if (!isMatch) {
        res.status(400).json({ error: 'Invalid credentials provided.' });
        return;
      }

      const token = jwt.sign(
        { id: foundUser.id, username: foundUser.username, role: foundUser.role },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      const { password: _, ...userWithoutPassword } = foundUser;
      res.json({ user: userWithoutPassword, token });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Login failed' });
    }
  });

  // Forgot password endpoint (simulates reset with a success token/toast friendly message)
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: 'Email address is required.' });
        return;
      }
      const user = await db.users.findOne({ email: email.toLowerCase().trim() });
      if (!user) {
        res.status(404).json({ error: 'No user registered with this email address' });
        return;
      }
      res.json({ message: 'A simulated password recovery instruction has been sent to your email.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get current user auth checks
  app.get('/api/auth/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await db.users.findOne({ id: req.user?.id });
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const { password: _, ...userWithoutPassword } = user as any;
      res.json({ user: userWithoutPassword });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Edit/Update Profile Details
  app.put('/api/auth/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fullname, bio, avatar } = req.body;
      const user = await db.users.findOne({ id: req.user?.id });
      if (!user) {
        res.status(404).json({ error: 'User account not found.' });
        return;
      }

      let updatedAvatar = user.avatar;
      if (avatar && avatar.startsWith('data:')) {
        updatedAvatar = saveBase64File(avatar, `avatar_${user.username}`);
      } else if (avatar) {
        updatedAvatar = avatar;
      }

      const updateFields: Partial<User> = {};
      if (fullname !== undefined) updateFields.fullname = fullname.trim();
      if (bio !== undefined) updateFields.bio = bio.trim();
      updateFields.avatar = updatedAvatar;

      await db.users.updateOne({ id: user.id }, { $set: updateFields });

      // Refresh post author metadata in their existing posts to maintain UI speed
      const userPosts = await db.posts.find({ userId: user.id });
      for (const p of userPosts) {
        await db.posts.updateOne({ id: p.id }, {
          $set: {
            fullname: fullname || user.fullname,
            userAvatar: updatedAvatar
          }
        });
      }

      const updatedUser = await db.users.findOne({ id: user.id });
      const { password: _, ...cleanUser } = updatedUser as any;
      res.json({ user: cleanUser, message: 'Profile changed successfully!' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get Suggestions of users (excluding self, and excluding already followed accounts)
  app.get('/api/users/suggestions', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const selfId = req.user?.id;
      const meUser = await db.users.findOne({ id: selfId });
      if (!meUser) {
        res.status(404).json({ error: 'Me profile not found' });
        return;
      }

      const allUsers = await db.users.find();
      const followingList = meUser.following || [];

      const suggestions = allUsers
        .filter(u => u.id !== selfId && !followingList.includes(u.id))
        .map(u => {
          const { password: _, ...safe } = u as any;
          return safe;
        })
        .slice(0, 10);

      res.json(suggestions);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Search users of the platform
  app.get('/api/users/search', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const q = (req.query.q as string || '').toLowerCase().trim();
      if (!q) {
        res.json([]);
        return;
      }
      const users = await db.users.find();
      const filtered = users
        .filter(u => u.username.toLowerCase().includes(q) || u.fullname.toLowerCase().includes(q))
        .map(u => {
          const { password: _, ...safe } = u as any;
          return safe;
        });
      res.json(filtered);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Follow/Unfollow user router
  app.post('/api/users/:targetId/follow', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const selfId = req.user!.id;
      const targetId = req.params.targetId;

      if (selfId === targetId) {
        res.status(400).json({ error: 'You are forbidden to follow yourself.' });
        return;
      }

      const me = await db.users.findOne({ id: selfId });
      const target = await db.users.findOne({ id: targetId });

      if (!me || !target) {
        res.status(404).json({ error: 'One or both of the profiles could not be retrieved.' });
        return;
      }

      const isFollowing = me.following ? me.following.includes(targetId) : false;

      if (isFollowing) {
        // Unfollow
        await db.users.updateOne({ id: selfId }, { $pull: { following: targetId } });
        await db.users.updateOne({ id: targetId }, { $pull: { followers: selfId } });

        res.json({ following: false, message: `Unfollowed ${target.username}` });
      } else {
        // Follow
        await db.users.updateOne({ id: selfId }, { $push: { following: targetId } });
        await db.users.updateOne({ id: targetId }, { $push: { followers: selfId } });

        // Add to Notifications db
        await db.notifications.insertOne({
          id: 'notif_' + Math.random().toString(36).substring(2, 11),
          receiverId: targetId,
          senderId: selfId,
          senderUsername: me.username,
          senderAvatar: me.avatar,
          type: 'follow',
          text: 'started following you.',
          isSeen: false,
          createdAt: new Date().toISOString()
        });

        // Push real-time follow notification over socket
        const onlineSocketId = activeSockets.get(targetId);
        if (onlineSocketId) {
          io.to(onlineSocketId).emit('new-notification', {
            type: 'follow',
            username: me.username,
            avatar: me.avatar,
            text: 'started following you.'
          });
        }

        res.json({ following: true, message: `Started following ${target.username}` });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Fetch individual user public profile stats
  app.get('/api/users/profile/:username', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const targetUser = await db.users.findOne({ username: req.params.username.toLowerCase().trim() });
      if (!targetUser) {
        res.status(404).json({ error: 'User profile not found.' });
        return;
      }

      const posts = await db.posts.find({ userId: targetUser.id });
      const { password: _, ...profileData } = targetUser as any;
      res.json({ user: profileData, posts });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Fetch a user's followers
  app.get('/api/users/:userId/followers', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await db.users.findOne({ id: req.params.userId });
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const followersIds = user.followers || [];
      const allUsers = await db.users.find();
      const list = allUsers
        .filter(u => followersIds.includes(u.id))
        .map(u => {
          const { password: _, ...safe } = u as any;
          return safe;
        });
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Fetch a user's following
  app.get('/api/users/:userId/following', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await db.users.findOne({ id: req.params.userId });
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const followingIds = user.following || [];
      const allUsers = await db.users.find();
      const list = allUsers
        .filter(u => followingIds.includes(u.id))
        .map(u => {
          const { password: _, ...safe } = u as any;
          return safe;
        });
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- POST & REELS API ROUTES ---

  // Upload Post
  app.post('/api/posts', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { caption, type, mediaUrls, taggedUsers } = req.body; // array of base64 data URLs
      if (!mediaUrls || !Array.isArray(mediaUrls) || mediaUrls.length === 0) {
        res.status(400).json({ error: 'At least one visual media attachment is required.' });
        return;
      }

      const activeUser = await db.users.findOne({ id: req.user!.id });
      if (!activeUser) {
        res.status(404).json({ error: 'User does not exist.' });
        return;
      }

      // Proactively save all base64 files locally
      const savedUrls = mediaUrls.map((base64String, index) => {
        return saveBase64File(base64String, `post_${activeUser.username}_${index}`);
      });

      // Pull hashtags
      const hashtags: string[] = [];
      if (caption) {
        const matches = caption.match(/#(\w+)/g);
        if (matches) {
          matches.forEach((tag: string) => {
            hashtags.push(tag.replace('#', '').toLowerCase());
          });
        }
      }

      const newPost: Post = {
        id: 'post_' + Math.random().toString(36).substring(2, 11),
        userId: activeUser.id,
        username: activeUser.username,
        fullname: activeUser.fullname,
        userAvatar: activeUser.avatar,
        type: type === 'reel' ? 'reel' : 'post',
        mediaUrls: savedUrls,
        caption: caption || '',
        hashtags,
        taggedUsers: Array.isArray(taggedUsers) ? taggedUsers : [],
        likes: [],
        commentsCount: 0,
        createdAt: new Date().toISOString()
      };

      await db.posts.insertOne(newPost);
      res.status(201).json(newPost);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Edit dynamic post captions
  app.put('/api/posts/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const post = await db.posts.findOne({ id: req.params.id });
      if (!post) {
        res.status(404).json({ error: 'Post not found.' });
        return;
      }
      if (post.userId !== req.user!.id && req.user!.role !== 'admin') {
        res.status(403).json({ error: 'Unauthorized to toggle edits on this piece of media.' });
        return;
      }

      const { caption } = req.body;
      const hashtags: string[] = [];
      if (caption) {
        const matches = caption.match(/#(\w+)/g);
        if (matches) {
          matches.forEach((tag: string) => {
            hashtags.push(tag.replace('#', '').toLowerCase());
          });
        }
      }

      await db.posts.updateOne({ id: post.id }, { $set: { caption, hashtags } });
      const updated = await db.posts.findOne({ id: post.id });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete individual post
  app.delete('/api/posts/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const post = await db.posts.findOne({ id: req.params.id });
      if (!post) {
        res.status(404).json({ error: 'Content does not exist.' });
        return;
      }
      if (post.userId !== req.user!.id && req.user!.role !== 'admin') {
        res.status(403).json({ error: 'Unauthorized to remove this post.' });
        return;
      }

      await db.posts.deleteOne({ id: post.id });
      // Delete child comments
      const comments = await db.comments.find({ postId: post.id });
      for (const com of comments) {
        await db.comments.deleteOne({ id: com.id });
      }

      res.json({ success: true, message: 'Content has been deleted successfully.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get Home Feed (Includes users following + suggestions)
  app.get('/api/posts/feed', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const selfId = req.user!.id;
      const meUser = await db.users.findOne({ id: selfId });
      if (!meUser) {
        res.status(404).json({ error: 'Me profile not found' });
        return;
      }

      const followingList = meUser.following || [];
      const showIds = [selfId, ...followingList];

      const allPosts = await db.posts.find();
      // Filter primarily for 'post' type, sort descending by date
      const feedPosts = allPosts
        .filter(p => p.type === 'post')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(feedPosts);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get Reels
  app.get('/api/posts/reels', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const allPosts = await db.posts.find();
      const reels = allPosts
        .filter(p => p.type === 'reel')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(reels);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Search posts via hashtags or text content search
  app.get('/api/posts/search', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const q = (req.query.q as string || '').toLowerCase().trim();
      if (!q) {
        // Return latest posts as default explore content
        const posts = await db.posts.find();
        res.json(posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        return;
      }

      const posts = await db.posts.find();
      const filtered = posts.filter(p => {
        const tagMatch = p.hashtags && p.hashtags.some(tag => tag.toLowerCase() === q || tag.toLowerCase().includes(q));
        const captionMatch = p.caption && p.caption.toLowerCase().includes(q);
        return tagMatch || captionMatch;
      });

      res.json(filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Like / Unlike action
  app.post('/api/posts/:id/like', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const selfId = req.user!.id;
      const post = await db.posts.findOne({ id: req.params.id });
      if (!post) {
        res.status(404).json({ error: 'Post structure could not be fetched.' });
        return;
      }

      const me = await db.users.findOne({ id: selfId });
      if (!me) {
        res.status(404).json({ error: 'User does not exist.' });
        return;
      }

      const isLiked = post.likes ? post.likes.includes(selfId) : false;

      if (isLiked) {
        // Unlike
        await db.posts.updateOne({ id: post.id }, { $pull: { likes: selfId } });
        res.json({ liked: false, likesCount: (post.likes.length - 1) });
      } else {
        // Like
        await db.posts.updateOne({ id: post.id }, { $push: { likes: selfId } });

        // Trigger Notification if not self
        if (post.userId !== selfId) {
          const contentSnippet = post.type === 'reel' ? 'your reel.' : 'your post.';
          await db.notifications.insertOne({
            id: 'notif_' + Math.random().toString(36).substring(2, 11),
            receiverId: post.userId,
            senderId: selfId,
            senderUsername: me.username,
            senderAvatar: me.avatar,
            type: 'like',
            postId: post.id,
            text: `liked ${contentSnippet}`,
            isSeen: false,
            createdAt: new Date().toISOString()
          });

          // Socket push notification
          const onlineSocketId = activeSockets.get(post.userId);
          if (onlineSocketId) {
            io.to(onlineSocketId).emit('new-notification', {
              type: 'like',
              username: me.username,
              avatar: me.avatar,
              text: `liked ${contentSnippet}`
            });
          }
        }

        res.json({ liked: true, likesCount: (post.likes.length + 1) });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Save / Bookmark action inside profiles
  app.post('/api/posts/:id/save', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const selfId = req.user!.id;
      const postId = req.params.id;

      const user = await db.users.findOne({ id: selfId });
      if (!user) {
        res.status(404).json({ error: 'User profile does not exist.' });
        return;
      }

      const saved = user.savedPosts || [];
      const isSaved = saved.includes(postId);

      if (isSaved) {
        await db.users.updateOne({ id: selfId }, { $pull: { savedPosts: postId } });
        res.json({ saved: false, message: 'Removed from bookmarks' });
      } else {
        await db.users.updateOne({ id: selfId }, { $push: { savedPosts: postId } });
        res.json({ saved: true, message: 'Saved to bookmarks' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get comments list for a specific post
  app.get('/api/posts/:id/comments', authenticateToken, async (req, res) => {
    try {
      const list = await db.comments.find({ postId: req.params.id });
      res.json(list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Create comment on post
  app.post('/api/posts/:id/comments', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { content } = req.body;
      if (!content || !content.trim()) {
        res.status(400).json({ error: 'Comment body is required.' });
        return;
      }

      const post = await db.posts.findOne({ id: req.params.id });
      if (!post) {
        res.status(404).json({ error: 'Post not found.' });
        return;
      }

      const user = await db.users.findOne({ id: req.user!.id });
      if (!user) {
        res.status(404).json({ error: 'Active profile not found.' });
        return;
      }

      const newComment: Comment = {
        id: 'comment_' + Math.random().toString(36).substring(2, 11),
        postId: post.id,
        userId: user.id,
        username: user.username,
        userAvatar: user.avatar,
        content: content.trim(),
        createdAt: new Date().toISOString()
      };

      await db.comments.insertOne(newComment);
      const commentsCount = (post.commentsCount || 0) + 1;
      await db.posts.updateOne({ id: post.id }, { $set: { commentsCount } });

      // Trigger notification if not commenting on self-post
      if (post.userId !== user.id) {
        await db.notifications.insertOne({
          id: 'notif_' + Math.random().toString(36).substring(2, 11),
          receiverId: post.userId,
          senderId: user.id,
          senderUsername: user.username,
          senderAvatar: user.avatar,
          type: 'comment',
          postId: post.id,
          text: `commented on your post: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`,
          isSeen: false,
          createdAt: new Date().toISOString()
        });

        // Push socket notification
        const targetSocketId = activeSockets.get(post.userId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('new-notification', {
            type: 'comment',
            username: user.username,
            avatar: user.avatar,
            text: `commented on your post.`
          });
        }
      }

      res.status(201).json(newComment);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete comment
  app.delete('/api/comments/:commentId', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const comment = await db.comments.findOne({ id: req.params.commentId });
      if (!comment) {
        res.status(404).json({ error: 'Comment does not exist' });
        return;
      }

      const post = await db.posts.findOne({ id: comment.postId });
      if (!post) {
        res.status(404).json({ error: 'Associated post missing' });
        return;
      }

      // Check permissions: only comment author, post author, or admin can delete comments
      if (comment.userId !== req.user!.id && post.userId !== req.user!.id && req.user!.role !== 'admin') {
        res.status(403).json({ error: 'Permission denied to delete comments.' });
        return;
      }

      await db.comments.deleteOne({ id: comment.id });
      const commentsCount = Math.max(0, (post.commentsCount || 0) - 1);
      await db.posts.updateOne({ id: post.id }, { $set: { commentsCount } });

      res.json({ success: true, message: 'Comment deleted successfully' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- STORY API ROUTES ---

  // Upload/Create story entry
  app.post('/api/stories', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { mediaUrl } = req.body; // base64 payload
      if (!mediaUrl) {
        res.status(400).json({ error: 'Story media file required' });
        return;
      }

      const user = await db.users.findOne({ id: req.user!.id });
      if (!user) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      const savedUrl = saveBase64File(mediaUrl, `story_${user.username}`);

      const newStory: Story = {
        id: 'story_' + Math.random().toString(36).substring(2, 11),
        userId: user.id,
        username: user.username,
        userAvatar: user.avatar,
        mediaUrl: savedUrl,
        viewers: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString() // 24 hours expiry
      };

      await db.stories.insertOne(newStory);
      res.status(201).json(newStory);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // List stories of self + followed users
  app.get('/api/stories', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const selfId = req.user!.id;
      const me = await db.users.findOne({ id: selfId });
      if (!me) {
        res.status(404).json({ error: 'Me profile invalid' });
        return;
      }

      const creators = [selfId, ...(me.following || [])];
      const stories = await db.stories.find();

      const activeStories = stories.filter(st => {
        const isNotExpired = new Date(st.expiresAt) > new Date();
        const isInCircle = creators.includes(st.userId);
        return isNotExpired && isInCircle;
      });

      // Group stories by creator to match clean carousel structures
      const groupedStories: { [userId: string]: { user: Partial<User>, stories: Story[] } } = {};

      for (const st of activeStories) {
        if (!groupedStories[st.userId]) {
          groupedStories[st.userId] = {
            user: { id: st.userId, username: st.username, avatar: st.userAvatar },
            stories: []
          };
        }
        groupedStories[st.userId].stories.push(st);
      }

      res.json(Object.values(groupedStories));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Record user viewing story
  app.post('/api/stories/:id/view', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const selfId = req.user!.id;
      const story = await db.stories.findOne({ id: req.params.id });
      if (!story) {
        res.status(404).json({ error: 'Story not found or expired.' });
        return;
      }

      const viewers = story.viewers || [];
      if (!viewers.includes(selfId)) {
        await db.stories.updateOne({ id: story.id }, { $push: { viewers: selfId } });
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- MESSAGES / CHAT SYSTEM ROUTES ---

  // Get or Create dynamic chat room with individual
  app.post('/api/chats', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const selfId = req.user!.id;
      const { recipientId } = req.body;
      if (!recipientId) {
        res.status(400).json({ error: 'Recipient ID is required to launch chat' });
        return;
      }

      const chats = await db.chats.find();
      // Find matches where both are participants
      let matchedChat = chats.find(c => c.participants.includes(selfId) && c.participants.includes(recipientId));

      if (!matchedChat) {
        matchedChat = {
          id: 'chat_' + Math.random().toString(36).substring(2, 11),
          participants: [selfId, recipientId],
          updatedAt: new Date().toISOString()
        };
        await db.chats.insertOne(matchedChat);
      }

      res.status(200).json(matchedChat);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get active user chats with complete recipient profile metadata
  app.get('/api/chats', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const selfId = req.user!.id;
      const allChats = await db.chats.find();
      const userChats = allChats.filter(c => c.participants.includes(selfId));

      const responseChats = [];
      const usersCache = new Map<string, User>();

      for (const chat of userChats) {
        const otherUserId = chat.participants.find(p => p !== selfId);
        if (!otherUserId) continue;

        let otherUser = usersCache.get(otherUserId);
        if (!otherUser) {
          const fetched = await db.users.findOne({ id: otherUserId });
          if (fetched) {
            otherUser = fetched;
            usersCache.set(otherUserId, fetched);
          }
        }

        if (!otherUser) continue;

        // Fetch last message for typing/ordering preview
        const chatMsgs = await db.messages.find({ chatId: chat.id });
        const lastMsgObj = chatMsgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        // Is online?
        const isOnline = userOnlineStatus.get(otherUserId) === 'online';

        responseChats.push({
          id: chat.id,
          recipient: {
            id: otherUser.id,
            username: otherUser.username,
            fullname: otherUser.fullname,
            avatar: otherUser.avatar,
            isOnline
          },
          lastMessage: lastMsgObj ? (lastMsgObj.text || '[Image/Emoji]') : 'Start conversing...',
          lastMessageSenderId: lastMsgObj ? lastMsgObj.senderId : null,
          lastMessageSeen: lastMsgObj ? lastMsgObj.seen : true,
          updatedAt: chat.updatedAt
        });
      }

      // Sort chats dynamically by last update time descending
      responseChats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      res.json(responseChats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get messages inside selected chat
  app.get('/api/chats/:id/messages', authenticateToken, async (req, res) => {
    try {
      const chatMessages = await db.messages.find({ chatId: req.params.id });
      res.json(chatMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Send message inside chat room
  app.post('/api/chats/:id/messages', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const chatId = req.params.id;
      const selfId = req.user!.id;
      const { text, mediaUrl, emoji } = req.body;

      if (!text && !mediaUrl && !emoji) {
        res.status(400).json({ error: 'Message body cannot be totally blank.' });
        return;
      }

      const chatObj = await db.chats.findOne({ id: chatId });
      if (!chatObj) {
        res.status(404).json({ error: 'Current room does not exist.' });
        return;
      }

      let finalMediaUrl = '';
      if (mediaUrl && mediaUrl.startsWith('data:')) {
        finalMediaUrl = saveBase64File(mediaUrl, `msg_${selfId}`);
      }

      const newMessage: Message = {
        id: 'msg_' + Math.random().toString(36).substring(2, 11),
        chatId,
        senderId: selfId,
        text: text || '',
        mediaUrl: finalMediaUrl || undefined,
        emoji: emoji || undefined,
        seen: false,
        createdAt: new Date().toISOString()
      };

      await db.messages.insertOne(newMessage);
      await db.chats.updateOne({ id: chatId }, { $set: { updatedAt: new Date().toISOString() } });

      // Identify receiver
      const receiverId = chatObj.participants.find(p => p !== selfId);

      // Push Live Socket event
      if (receiverId) {
        const receiverSocket = activeSockets.get(receiverId);
        if (receiverSocket) {
          io.to(receiverSocket).emit('message-received', newMessage);
        }
      }

      res.status(201).json(newMessage);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Mark messages as read in chat
  app.post('/api/chats/:id/seen', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const chatId = req.params.id;
      const selfId = req.user!.id;

      const unseenMessages = await db.messages.find({ chatId, seen: false });
      for (const msg of unseenMessages) {
        if (msg.senderId !== selfId) {
          await db.messages.updateOne({ id: msg.id }, { $set: { seen: true } });
        }
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- NOTIFICATIONS API ---

  // Get notifications
  app.get('/api/notifications', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const list = await db.notifications.find({ receiverId: req.user!.id });
      res.json(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Mark notification seen
  app.post('/api/notifications/seen', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const list = await db.notifications.find({ receiverId: req.user!.id, isSeen: false });
      for (const item of list) {
        await db.notifications.updateOne({ id: item.id }, { $set: { isSeen: true } });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- ADMIN PORTAL ANALYTICS ROUTES ---

  // Fetch complete admin workspace panels
  app.get('/api/admin/analytics', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: 'Permission denied. Staff credential required.' });
        return;
      }

      const totalUsers = await db.users.count();
      const allPosts = await db.posts.find();
      const totalPosts = allPosts.filter(p => p.type === 'post').length;
      const totalReels = allPosts.filter(p => p.type === 'reel').length;
      const totalStories = await db.stories.count();
      const totalMessages = await db.messages.count();

      // Posts Count aggregated over last 7 days
      const days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();

      const postsOverTime = days.map(date => {
        const count = allPosts.filter(p => p.createdAt.startsWith(date)).length;
        return { date, count };
      });

      const userRolesDistribution = [
        { role: 'admin', count: await db.users.count({ role: 'admin' }) },
        { role: 'user', count: await db.users.count({ role: 'user' }) }
      ];

      const dashboardData: DashboardAnalytics = {
        totalUsers,
        totalPosts,
        totalReels,
        totalStories,
        totalMessages,
        activeToday: Array.from(userOnlineStatus.values()).filter(v => v === 'online').length + 1, // At least self
        postsOverTime,
        userRolesDistribution
      };

      res.json(dashboardData);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Manage users list for Admin Dashboard
  app.get('/api/admin/users', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const all = await db.users.find();
      res.json(all.map(u => {
        const { password: _, ...safe } = u as any;
        return safe;
      }));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete generic inappropriate user accounts
  app.delete('/api/admin/users/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const uId = req.params.userId;
      if (uId === req.user!.id) {
        res.status(400).json({ error: 'Cannot banish your own self!' });
        return;
      }

      await db.users.deleteOne({ id: uId });
      // Delete their posts too
      const userPosts = await db.posts.find({ userId: uId });
      for (const p of userPosts) {
        await db.posts.deleteOne({ id: p.id });
      }

      res.json({ success: true, message: 'User deleted and clean slate achieved.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Toggle Verification Badge
  app.post('/api/admin/users/:userId/verify', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const uId = req.params.userId;
      const user = await db.users.findOne({ id: uId });
      if (!user) {
        res.status(404).json({ error: 'User does not exist.' });
        return;
      }
      const currentVerified = !!user.isVerified;
      await db.users.updateOne({ id: uId }, { $set: { isVerified: !currentVerified } });
      res.json({ success: true, isVerified: !currentVerified });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- CONNECT WEB SOCKETS ---
  io.on('connection', (socket) => {
    socket.on('register-user', (userId: string) => {
      activeSockets.set(userId, socket.id);
      userOnlineStatus.set(userId, 'online');
      io.emit('online-status-changed', { userId, status: 'online' });
    });

    socket.on('typing', ({ chatId, senderId, isTyping }) => {
      // Find other participants
      db.chats.findOne({ id: chatId }).then((chat) => {
        if (chat) {
          const recId = chat.participants.find(p => p !== senderId);
          if (recId) {
            const socketId = activeSockets.get(recId);
            if (socketId) {
              io.to(socketId).emit('typing-received', { chatId, isTyping });
            }
          }
        }
      });
    });

    socket.on('disconnect', () => {
      let foundUserId: string | null = null;
      for (const [userId, sId] of activeSockets.entries()) {
        if (sId === socket.id) {
          foundUserId = userId;
          break;
        }
      }
      if (foundUserId) {
        activeSockets.delete(foundUserId);
        userOnlineStatus.set(foundUserId, 'offline');
        io.emit('online-status-changed', { userId: foundUserId, status: 'offline' });
      }
    });
  });

  // --- MOUNT VITE DEVELOPMENT OR STATIC SERVING MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Pulse Express Server running at http://0.0.0.0:${PORT}`);
  });
}

initServer().catch(console.error);
