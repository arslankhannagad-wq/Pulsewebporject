import fs from 'fs';
import path from 'path';
import { MongoClient, Db, Collection } from 'mongodb';
import { User, Post, Comment, Story, Message, Chat, Notification } from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Simple per-file mutex to prevent concurrent read-modify-write race conditions
const writeLocks = new Map<string, Promise<void>>();

async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  while (writeLocks.has(filePath)) {
    await writeLocks.get(filePath);
  }
  const lockPromise = (async () => {
    try {
      return await fn();
    } finally {
      writeLocks.delete(filePath);
    }
  })();
  writeLocks.set(filePath, lockPromise.then(() => {}));
  return lockPromise;
}

// Check MongoDB URI
const mongoUri = process.env.MONGODB_URI;
let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

let isMongoConnected = false;
let mongoReconnectTimer: ReturnType<typeof setInterval> | null = null;

export async function connectDB() {
  if (!mongoUri || !mongoUri.trim()) {
    console.log('MONGODB_URI not set. Falling back to local file JSON database.');
    return;
  }
  
  const trimmedUri = mongoUri.trim();
  if (!trimmedUri.startsWith('mongodb://') && !trimmedUri.startsWith('mongodb+srv://')) {
    console.log('MONGODB_URI format is invalid (must start with "mongodb://" or "mongodb+srv://").');
    console.log('Falling back to local file JSON database.');
    return;
  }

  await tryConnectMongo(trimmedUri);
  startMongoWatch(trimmedUri);
}

async function tryConnectMongo(uri: string) {
  try {
    if (mongoClient) {
      try { await mongoClient.close(); } catch {}
    }
    mongoClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      timeoutMS: 10000,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db('pulse_db');
    isMongoConnected = true;
    resetAllDegradations();
    console.log('Successfully connected to MongoDB Atlas!');
  } catch (error) {
    isMongoConnected = false;
    mongoDb = null;
    console.error('Error connecting to MongoDB Atlas:', (error as Error).message);
    console.log('Falling back to local file JSON database.');
  }
}

function startMongoWatch(uri: string) {
  if (mongoReconnectTimer) clearInterval(mongoReconnectTimer);
  mongoReconnectTimer = setInterval(async () => {
    if (isMongoConnected) {
      try {
        await mongoDb?.admin().ping();
      } catch {
        console.log('MongoDB connection lost. Attempting reconnect...');
        isMongoConnected = false;
        await tryConnectMongo(uri);
      }
    } else {
      await tryConnectMongo(uri);
    }
  }, 30000);
}

// Interface representing standard collection operations
interface BaseCollection<T> {
  find(query?: any): Promise<T[]>;
  findOne(query: any): Promise<T | null>;
  insertOne(doc: T): Promise<T>;
  updateOne(query: any, update: any): Promise<boolean>;
  deleteOne(query: any): Promise<boolean>;
  count(query?: any): Promise<number>;
}

// Local JSON File implementation
class JsonCollectionHelper<T extends { id?: string; _id?: any; [key: string]: any }> implements BaseCollection<T> {
  private filePath: string;

  constructor(filename: string) {
    this.filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
  }

  private read(): T[] {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content) as T[];
    } catch {
      return [];
    }
  }

  private write(data: T[]) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  async find(query: any = {}): Promise<T[]> {
    const data = this.read();
    return data.filter(item => {
      for (const key in query) {
        if (query[key] !== undefined && item[key] !== query[key]) {
          // simple check for array inclusion or primitive equality
          if (Array.isArray(item[key]) && typeof query[key] === 'string') {
            if (!item[key].includes(query[key])) return false;
          } else {
            return false;
          }
        }
      }
      return true;
    });
  }

  async findOne(query: any): Promise<T | null> {
    const results = await this.find(query);
    return results.length > 0 ? results[0] : null;
  }

  async insertOne(doc: T): Promise<T> {
    return withFileLock(this.filePath, async () => {
      const data = this.read();
      if (!doc.id && !doc._id) {
        (doc as any).id = Math.random().toString(36).substring(2, 11);
      }
      data.push(doc);
      this.write(data);
      return doc;
    });
  }

  async updateOne(query: any, update: any): Promise<boolean> {
    return withFileLock(this.filePath, async () => {
      const data = this.read();
      let updated = false;
      const itemIndex = data.findIndex(item => {
        for (const key in query) {
          if (item[key] !== query[key]) return false;
        }
        return true;
      });

      if (itemIndex > -1) {
        const item = data[itemIndex] as any;
        if (update.$set) {
          Object.assign(item, update.$set);
        } else if (update.$push) {
          for (const key in update.$push) {
            if (!Array.isArray(item[key])) item[key] = [];
            item[key].push(update.$push[key]);
          }
        } else if (update.$pull) {
          for (const key in update.$pull) {
            if (Array.isArray(item[key])) {
              item[key] = item[key].filter((val: any) => val !== update.$pull[key]);
            }
          }
        } else {
          Object.assign(item, update);
        }
        data[itemIndex] = item;
        this.write(data);
        updated = true;
      }
      return updated;
    });
  }

  async deleteOne(query: any): Promise<boolean> {
    return withFileLock(this.filePath, async () => {
      const data = this.read();
      const initialLength = data.length;
      const filtered = data.filter(item => {
        for (const key in query) {
          if (item[key] !== query[key]) return true;
        }
        return false;
      });
      this.write(filtered);
      return filtered.length < initialLength;
    });
  }

  async count(query: any = {}): Promise<number> {
    const items = await this.find(query);
    return items.length;
  }
}

// MongoDB Implementation wrapper
class MongoCollectionHelper<T extends { id?: string; _id?: any; [key: string]: any }> implements BaseCollection<T> {
  private collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  private get collection(): Collection<any> {
    if (!mongoDb) {
      throw new Error('Database not connected');
    }
    return mongoDb.collection(this.collectionName);
  }

  async find(query: any = {}): Promise<T[]> {
    const mappedQuery = { ...query };
    if (mappedQuery.id) {
      mappedQuery._id = mappedQuery.id;
      delete mappedQuery.id;
    }
    const results = await this.collection.find(mappedQuery).toArray();
    return results.map(r => {
      const { _id, ...rest } = r;
      return { id: _id, ...rest } as any as T;
    });
  }

  async findOne(query: any): Promise<T | null> {
    const mappedQuery = { ...query };
    if (mappedQuery.id) {
      mappedQuery._id = mappedQuery.id;
      delete mappedQuery.id;
    }
    const result = await this.collection.findOne(mappedQuery);
    if (!result) return null;
    const { _id, ...rest } = result;
    return { id: _id, ...rest } as any as T;
  }

  async insertOne(doc: T): Promise<T> {
    const { id, ...rest } = doc;
    const finalId = id || Math.random().toString(36).substring(2, 11);
    await this.collection.insertOne({ _id: finalId, ...rest });
    return { id: finalId, ...rest } as any as T;
  }

  async updateOne(query: any, update: any): Promise<boolean> {
    const mappedQuery = { ...query };
    if (mappedQuery.id) {
      mappedQuery._id = mappedQuery.id;
      delete mappedQuery.id;
    }
    const result = await this.collection.updateOne(mappedQuery, update);
    return result.modifiedCount > 0;
  }

  async deleteOne(query: any): Promise<boolean> {
    const mappedQuery = { ...query };
    if (mappedQuery.id) {
      mappedQuery._id = mappedQuery.id;
      delete mappedQuery.id;
    }
    const result = await this.collection.deleteOne(mappedQuery);
    return result.deletedCount > 0;
  }

  async count(query: any = {}): Promise<number> {
    const mappedQuery = { ...query };
    if (mappedQuery.id) {
      mappedQuery._id = mappedQuery.id;
      delete mappedQuery.id;
    }
    return this.collection.countDocuments(mappedQuery);
  }
}

// Adapter dispatcher that decides between Mongo & Local File
// Auto-degrades to JSON if MongoDB operations fail.
class CollectionAdapter<T extends { id?: string; _id?: any; [key: string]: any }> implements BaseCollection<T> {
  private jsonHelper: JsonCollectionHelper<T>;
  private mongoHelper: MongoCollectionHelper<T>;
  private mongoDegraded = false;

  constructor(name: string) {
    this.jsonHelper = new JsonCollectionHelper<T>(`${name}.json`);
    this.mongoHelper = new MongoCollectionHelper<T>(name);
  }

  private get activeCollection(): BaseCollection<T> {
    if (isMongoConnected && mongoDb && !this.mongoDegraded) {
      return this.mongoHelper;
    }
    return this.jsonHelper;
  }

  private async withFallback<R>(fn: (helper: BaseCollection<T>) => Promise<R>): Promise<R> {
    if (isMongoConnected && mongoDb && !this.mongoDegraded) {
      try {
        return await fn(this.mongoHelper);
      } catch (e: any) {
        console.error('MongoDB operation failed, degrading to JSON fallback:', e.message);
        this.mongoDegraded = true;
        return fn(this.jsonHelper);
      }
    }
    return fn(this.jsonHelper);
  }

  async find(query?: any): Promise<T[]> {
    return this.withFallback(h => h.find(query));
  }

  async findOne(query: any): Promise<T | null> {
    return this.withFallback(h => h.findOne(query));
  }

  async insertOne(doc: T): Promise<T> {
    return this.withFallback(h => h.insertOne(doc));
  }

  async updateOne(query: any, update: any): Promise<boolean> {
    return this.withFallback(h => h.updateOne(query, update));
  }

  async deleteOne(query: any): Promise<boolean> {
    return this.withFallback(h => h.deleteOne(query));
  }

  async count(query?: any): Promise<number> {
    return this.withFallback(h => h.count(query));
  }

  resetDegradation() {
    this.mongoDegraded = false;
  }
}

const dbAdapters: CollectionAdapter<any>[] = [];

function createAdapter<T extends { id?: string; _id?: any; [key: string]: any }>(name: string) {
  const adapter = new CollectionAdapter<T>(name);
  dbAdapters.push(adapter);
  return adapter;
}

function resetAllDegradations() {
  for (const a of dbAdapters) a.resetDegradation();
}

// Database exports
export const db = {
  users: createAdapter<User>('users'),
  posts: createAdapter<Post>('posts'),
  comments: createAdapter<Comment>('comments'),
  stories: createAdapter<Story>('stories'),
  chats: createAdapter<Chat>('chats'),
  messages: createAdapter<Message>('messages'),
  notifications: createAdapter<Notification>('notifications'),
  isMongoConnected: () => isMongoConnected,
  resetDegradations: resetAllDegradations,
};
