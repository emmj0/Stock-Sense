const User = require('../models/User');
const Stock = require('../models/Stock');
const Notification = require('../models/Notification');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const parsePrice = (v) => parseFloat(String(v == null ? '' : v).replace(/,/g, '')) || 0;

/** Current market price for a symbol (from the live market_watch collection). */
async function priceOf(symbol) {
  const stock = await Stock.findOne({ SYMBOL: symbol }).lean();
  if (!stock) return null;
  return parsePrice(stock.CURRENT);
}

/** Add cash to the wallet. */
async function credit(userId, amount) {
  const amt = round2(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('Enter an amount greater than zero');
  if (amt > 100_000_000) throw new Error('Amount is too large');
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  user.balance = round2((user.balance || 0) + amt);
  await Notification.create({
    user: user._id,
    type: 'credit',
    title: `Rs ${amt.toLocaleString('en-PK')} added to balance`,
    message: `Your available balance is now Rs ${user.balance.toLocaleString('en-PK')}.`,
  });
  await user.save();
  return user;
}

/** Buy `quantity` shares of `symbol` at the live price, paying from the wallet. */
async function buy(userId, symbol, quantity) {
  const sym = String(symbol || '').toUpperCase();
  const qty = Math.floor(Number(quantity));
  if (!sym) throw new Error('symbol is required');
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity must be at least 1');

  const price = await priceOf(sym);
  if (!price) throw new Error('Symbol not found in market data');

  const cost = round2(qty * price);
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if ((user.balance || 0) < cost) {
    throw new Error(`Not enough balance. This costs Rs ${cost.toLocaleString('en-PK')} but you have Rs ${(user.balance || 0).toLocaleString('en-PK')}. Add credit first.`);
  }

  user.balance = round2((user.balance || 0) - cost);
  const existing = user.portfolio.find((p) => p.symbol === sym);
  if (existing) {
    const prevCost = (existing.averageCost || price) * existing.quantity;
    const newQty = existing.quantity + qty;
    existing.averageCost = round2((prevCost + cost) / newQty);
    existing.quantity = newQty;
    // keep the original addedAt so the holding still auto-sells ~a week after first purchase
  } else {
    user.portfolio.push({ symbol: sym, quantity: qty, averageCost: price, addedAt: new Date() });
  }

  await Notification.create({
    user: user._id,
    symbol: sym,
    type: 'buy',
    title: `Bought ${qty} ${sym}`,
    message: `${qty} share${qty === 1 ? '' : 's'} at Rs ${price.toFixed(2)} — Rs ${cost.toLocaleString('en-PK')} deducted. Balance: Rs ${user.balance.toLocaleString('en-PK')}.`,
  });
  await user.save();
  return { user, price, cost };
}

/** Sell `quantity` shares (or the whole position) at the live price, crediting the wallet. */
async function sell(userId, symbol, quantity) {
  const sym = String(symbol || '').toUpperCase();
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  const item = user.portfolio.find((p) => p.symbol === sym);
  if (!item) throw new Error('You do not hold this stock');

  let qty = quantity === undefined || quantity === null ? item.quantity : Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity must be at least 1');
  if (qty > item.quantity) throw new Error(`You only hold ${item.quantity} share${item.quantity === 1 ? '' : 's'}`);

  const price = await priceOf(sym);
  if (!price) throw new Error('Symbol not found in market data');

  const proceeds = round2(qty * price);
  user.balance = round2((user.balance || 0) + proceeds);
  if (qty >= item.quantity) {
    user.portfolio = user.portfolio.filter((p) => p.symbol !== sym);
  } else {
    item.quantity -= qty;
  }

  await Notification.create({
    user: user._id,
    symbol: sym,
    type: 'sell',
    title: `Sold ${qty} ${sym}`,
    message: `${qty} share${qty === 1 ? '' : 's'} at Rs ${price.toFixed(2)} — Rs ${proceeds.toLocaleString('en-PK')} added. Balance: Rs ${user.balance.toLocaleString('en-PK')}.`,
  });
  await user.save();
  return { user, price, proceeds };
}

module.exports = { credit, buy, sell, priceOf };
