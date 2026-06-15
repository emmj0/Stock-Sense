const request = require('supertest');
const createApp = require('../src/app');

const app = createApp();

let counter = 0;
function uniqueEmail() {
  counter += 1;
  return `user${counter}.${Date.now()}@test.com`;
}

// Register a fresh user through the real signup route and return a token.
async function registerUser(overrides = {}) {
  const payload = { name: 'Test User', email: uniqueEmail(), password: 'Password123', ...overrides };
  const res = await request(app).post('/api/auth/signup').send(payload);
  return { token: res.body.token, userId: res.body.user.id, email: payload.email, password: payload.password };
}

const bearer = (token) => `Bearer ${token}`;

module.exports = { app, request, registerUser, bearer };
