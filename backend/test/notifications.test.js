const { app, request, registerUser, bearer } = require('./helpers');
const Prediction = require('../src/models/Prediction');

describe('Notifications API', () => {
  test('generates a notification from a prediction on a watched symbol', async () => {
    const { token } = await registerUser();
    const h = bearer(token);

    await request(app).post('/api/user/watchlist').set('Authorization', h).send({ symbol: 'ENGRO' });
    await Prediction.create({ symbol: 'ENGRO', signal: 'BUY', predictedReturn: 3.2, predictedPrice: 110, dataAsOf: '2026-06-15' });

    const res = await request(app).get('/api/notifications').set('Authorization', h);
    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBeGreaterThan(0);
    expect(res.body.unreadCount).toBeGreaterThan(0);
    const n = res.body.notifications.find((x) => x.symbol === 'ENGRO');
    expect(n).toBeTruthy();
    expect(n.type).toBe('up'); // +3.2% → "could go up"
  });

  test('does not duplicate a notification for the same prediction update', async () => {
    const { token } = await registerUser();
    const h = bearer(token);
    await request(app).post('/api/user/watchlist').set('Authorization', h).send({ symbol: 'OGDC' });
    await Prediction.create({ symbol: 'OGDC', signal: 'HOLD', predictedReturn: 0.2, predictedPrice: 90, dataAsOf: '2026-06-15' });

    await request(app).get('/api/notifications').set('Authorization', h);
    const second = await request(app).get('/api/notifications').set('Authorization', h);
    const ogdc = second.body.notifications.filter((x) => x.symbol === 'OGDC');
    expect(ogdc).toHaveLength(1);
  });

  test('mark-all-read clears the unread count', async () => {
    const { token } = await registerUser();
    const h = bearer(token);
    await request(app).post('/api/user/watchlist').set('Authorization', h).send({ symbol: 'LUCK' });
    await Prediction.create({ symbol: 'LUCK', signal: 'SELL', predictedReturn: -2.5, predictedPrice: 480, dataAsOf: '2026-06-15' });
    await request(app).get('/api/notifications').set('Authorization', h);

    await request(app).post('/api/notifications/read-all').set('Authorization', h);
    const after = await request(app).get('/api/notifications').set('Authorization', h);
    expect(after.body.unreadCount).toBe(0);
  });

  test('a single notification can be toggled read/unread', async () => {
    const { token } = await registerUser();
    const h = bearer(token);
    await request(app).post('/api/user/watchlist').set('Authorization', h).send({ symbol: 'MCB' });
    await Prediction.create({ symbol: 'MCB', signal: 'BUY', predictedReturn: 4, predictedPrice: 250, dataAsOf: '2026-06-15' });
    const list = await request(app).get('/api/notifications').set('Authorization', h);
    const id = list.body.notifications[0]._id;

    const read = await request(app).patch(`/api/notifications/${id}`).set('Authorization', h).send({ read: true });
    expect(read.status).toBe(200);
    expect(read.body.notification.read).toBe(true);
  });
});
