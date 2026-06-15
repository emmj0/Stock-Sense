const { app, request, registerUser, bearer } = require('./helpers');
const Stock = require('../src/models/Stock');

// Seed a tradeable stock at a known price (Stock stores prices as strings).
async function seedStock(symbol = 'ENGRO', current = '100') {
  await Stock.create({ SYMBOL: symbol, CURRENT: current });
}

describe('Wallet & trading API', () => {
  test('credit adds funds to the balance', async () => {
    const { token } = await registerUser();
    const res = await request(app).post('/api/user/credit').set('Authorization', bearer(token)).send({ amount: 500 });
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(500);
  });

  test('credit rejects a non-positive amount', async () => {
    const { token } = await registerUser();
    const res = await request(app).post('/api/user/credit').set('Authorization', bearer(token)).send({ amount: 0 });
    expect(res.status).toBe(400);
  });

  test('buying deducts the cost from the balance and adds the holding', async () => {
    await seedStock('ENGRO', '60');
    const { token } = await registerUser();
    await request(app).post('/api/user/credit').set('Authorization', bearer(token)).send({ amount: 200 });

    const buy = await request(app).post('/api/user/buy').set('Authorization', bearer(token)).send({ symbol: 'ENGRO', quantity: 3 });
    expect(buy.status).toBe(200);
    expect(buy.body.cost).toBe(180); // 3 * 60
    expect(buy.body.balance).toBe(20); // 200 - 180
    expect(buy.body.portfolio.find((p) => p.symbol === 'ENGRO').quantity).toBe(3);
  });

  test('buying is blocked when the balance is insufficient', async () => {
    await seedStock('LUCK', '500');
    const { token } = await registerUser();
    await request(app).post('/api/user/credit').set('Authorization', bearer(token)).send({ amount: 100 });

    const buy = await request(app).post('/api/user/buy').set('Authorization', bearer(token)).send({ symbol: 'LUCK', quantity: 1 });
    expect(buy.status).toBe(400);
    expect(buy.body.message).toMatch(/balance/i);
  });

  test('selling returns the proceeds to the balance', async () => {
    await seedStock('ENGRO', '100');
    const { token } = await registerUser();
    await request(app).post('/api/user/credit').set('Authorization', bearer(token)).send({ amount: 1000 });
    await request(app).post('/api/user/buy').set('Authorization', bearer(token)).send({ symbol: 'ENGRO', quantity: 5 }); // -500 → 500

    const sell = await request(app).post('/api/user/sell').set('Authorization', bearer(token)).send({ symbol: 'ENGRO', quantity: 2 });
    expect(sell.status).toBe(200);
    expect(sell.body.proceeds).toBe(200); // 2 * 100
    expect(sell.body.balance).toBe(700); // 500 + 200
    expect(sell.body.portfolio.find((p) => p.symbol === 'ENGRO').quantity).toBe(3);
  });

  test('cannot sell a stock you do not hold', async () => {
    await seedStock('HBL', '90');
    const { token } = await registerUser();
    const sell = await request(app).post('/api/user/sell').set('Authorization', bearer(token)).send({ symbol: 'HBL', quantity: 1 });
    expect(sell.status).toBe(400);
  });
});
