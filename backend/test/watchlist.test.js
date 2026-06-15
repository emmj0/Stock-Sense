const { app, request, registerUser, bearer } = require('./helpers');

describe('Watchlist API', () => {
  test('add, list and remove a symbol', async () => {
    const { token } = await registerUser();
    const h = bearer(token);

    let res = await request(app).get('/api/user/watchlist').set('Authorization', h);
    expect(res.status).toBe(200);
    expect(res.body.watchlist).toEqual([]);

    res = await request(app).post('/api/user/watchlist').set('Authorization', h).send({ symbol: 'engro' });
    expect(res.status).toBe(200);
    expect(res.body.watchlist).toContain('ENGRO'); // normalised to uppercase

    // adding the same symbol again should not duplicate it
    res = await request(app).post('/api/user/watchlist').set('Authorization', h).send({ symbol: 'ENGRO' });
    expect(res.body.watchlist.filter((s) => s === 'ENGRO')).toHaveLength(1);

    res = await request(app).delete('/api/user/watchlist/ENGRO').set('Authorization', h);
    expect(res.status).toBe(200);
    expect(res.body.watchlist).not.toContain('ENGRO');
  });

  test('rejects an empty symbol', async () => {
    const { token } = await registerUser();
    const res = await request(app).post('/api/user/watchlist').set('Authorization', bearer(token)).send({});
    expect(res.status).toBe(400);
  });
});
