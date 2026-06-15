const { app, request, registerUser, bearer } = require('./helpers');

describe('Auth API', () => {
  test('signup returns a token and the new user', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Alice', email: 'alice@test.com', password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('alice@test.com');
  });

  test('signup rejects a duplicate email', async () => {
    await request(app).post('/api/auth/signup').send({ name: 'Bob', email: 'bob@test.com', password: 'Password123' });
    const res = await request(app).post('/api/auth/signup').send({ name: 'Bob2', email: 'bob@test.com', password: 'Password123' });
    expect(res.status).toBe(400);
  });

  test('login succeeds with correct credentials and fails with wrong ones', async () => {
    const { email, password } = await registerUser();
    const ok = await request(app).post('/api/auth/login').send({ email, password });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const bad = await request(app).post('/api/auth/login').send({ email, password: 'wrongpass' });
    expect(bad.status).toBe(400);
  });

  test('GET /me requires a token and returns the current user', async () => {
    const { token } = await registerUser();
    const noToken = await request(app).get('/api/auth/me');
    expect(noToken.status).toBe(401);

    const me = await request(app).get('/api/auth/me').set('Authorization', bearer(token));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBeTruthy();
    expect(me.body.user.password).toBeUndefined(); // never leak the hash
  });

  test('new users start with a zero balance', async () => {
    const { token } = await registerUser();
    const me = await request(app).get('/api/auth/me').set('Authorization', bearer(token));
    expect(me.body.user.balance || 0).toBe(0);
  });
});
