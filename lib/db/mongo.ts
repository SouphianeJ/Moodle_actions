import { MongoClient, Db } from 'mongodb';

interface MongoConnection {
  client: MongoClient;
  db: Db;
}

declare global {
  var _mongoClientPromise: Promise<MongoConnection> | undefined;
}

let cached = global._mongoClientPromise;

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable');
  }
  return uri;
}

async function connectToDatabase(): Promise<MongoConnection> {
  if (cached) {
    return cached;
  }

  const client = new MongoClient(getMongoUri());
  
  cached = client.connect().then((client) => ({
    client,
    db: client.db(),
  }));

  global._mongoClientPromise = cached;

  return cached;
}

export async function getDatabase(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

export async function getCollection<T extends object>(name: string) {
  const db = await getDatabase();
  return db.collection<T>(name);
}

export { connectToDatabase };
