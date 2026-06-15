const mongoose = require('mongoose');

// Ensure a JWT secret exists even if globalSetup ordering changes.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
});

// Clean slate between tests so they don't bleed into each other.
afterEach(async () => {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});
