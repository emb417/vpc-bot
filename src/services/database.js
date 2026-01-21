import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";

const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;

const uri = `mongodb+srv://${DB_USER}:${DB_PASSWORD}@cluster0.blwxx.mongodb.net/${DB_NAME}?retryWrites=true&w=majority`;

let client = null;
let db = null;

/**
 * Initialize the database connection with connection pooling.
 * This should be called once at application startup.
 */
export const initDatabase = async () => {
  if (client && db) {
    return db;
  }

  client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  });

  await client.connect();
  db = client.db(DB_NAME);

  return db;
};

/**
 * Get the database instance. Must call initDatabase first.
 */
export const getDb = () => {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase first.");
  }
  return db;
};

/**
 * Get a collection, creating it if it doesn't exist.
 */
export const getCollection = async (collectionName) => {
  const database = getDb();
  const collections = await database.collections();

  if (!collections.some((c) => c.collectionName === collectionName)) {
    await database.createCollection(collectionName);
  }

  return database.collection(collectionName);
};

/**
 * Generate a new ObjectId.
 */
export const generateObjectId = () => new ObjectId();

/**
 * Get all documents from a collection.
 */
export const getAll = async (collectionName) => {
  const collection = await getCollection(collectionName);
  return collection.find({}).toArray();
};

/**
 * Insert a single document.
 */
export const insertOne = async (doc, collectionName) => {
  const collection = await getCollection(collectionName);
  return collection.insertOne(doc);
};

/**
 * Insert multiple documents.
 */
export const insertMany = async (docs, collectionName) => {
  const collection = await getCollection(collectionName);
  return collection.insertMany(docs);
};

/**
 * Find documents matching a filter.
 */
export const find = async (filter, collectionName) => {
  const collection = await getCollection(collectionName);
  return collection.find(filter).toArray();
};

/**
 * Find a single document matching a filter.
 */
export const findOne = async (filter, collectionName) => {
  const collection = await getCollection(collectionName);
  return collection.findOne(filter);
};

/**
 * Find and update a single document.
 */
export const findOneAndUpdate = async (
  filter,
  update,
  options,
  collectionName
) => {
  const collection = await getCollection(collectionName);
  return collection.findOneAndUpdate(filter, update, options);
};

/**
 * Find the current week for a channel.
 */
export const findCurrentWeek = async (channelName) => {
  const collection = await getCollection("weeks");
  return collection.findOne({
    channelName: channelName,
    isArchived: false,
  });
};

/**
 * Find the current season for a channel.
 */
export const findCurrentSeason = async (channelName) => {
  const collection = await getCollection("seasons");
  return collection.findOne({
    channelName: channelName,
    isArchived: false,
  });
};

/**
 * Find the current playoff for a channel.
 */
export const findCurrentPlayoff = async (channelName) => {
  const collection = await getCollection("playoffs");
  return collection.findOne({
    channelName: channelName,
    isArchived: false,
  });
};

/**
 * Find the current playoff round for a channel.
 */
export const findCurrentPlayoffRound = async (channelName) => {
  const collection = await getCollection("rounds");
  return collection.findOne({
    channelName: channelName,
    isArchived: false,
  });
};

/**
 * Update a single document.
 */
export const updateOne = async (filter, update, options, collectionName) => {
  const collection = await getCollection(collectionName);
  return collection.updateOne(filter, update, options);
};

/**
 * Delete all documents in a collection.
 */
export const deleteAll = async (collectionName) => {
  const collection = await getCollection(collectionName);
  return collection.deleteMany({});
};

/**
 * Run an aggregation pipeline.
 */
export const aggregate = async (pipeline, collectionName) => {
  const collection = await getCollection(collectionName);
  return collection.aggregate(pipeline).toArray();
};

/**
 * Close the database connection gracefully.
 */
export const closeDatabase = async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
};

export default {
  initDatabase,
  getDb,
  getCollection,
  generateObjectId,
  getAll,
  insertOne,
  insertMany,
  find,
  findOne,
  findOneAndUpdate,
  findCurrentWeek,
  findCurrentSeason,
  findCurrentPlayoff,
  findCurrentPlayoffRound,
  updateOne,
  deleteAll,
  aggregate,
  closeDatabase,
};
