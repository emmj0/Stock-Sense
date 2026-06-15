module.exports = async () => {
  const instance = global.__MONGOINSTANCE;
  if (instance) await instance.stop();
};
