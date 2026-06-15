const { MongoMemoryServer } = require('mongodb-memory-server');

// Spin up a throwaway in-memory MongoDB for the whole test run.
module.exports = async () => {
  const instance = await MongoMemoryServer.create();
  global.__MONGOINSTANCE = instance;
  process.env.MONGO_URI = instance.getUri();
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
};
