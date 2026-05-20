const { AsyncLocalStorage } = require('async_hooks');

const requestContext = new AsyncLocalStorage();

const runWithRequestContext = (context, callback) => requestContext.run(context, callback);

const getRequestContext = () => requestContext.getStore() || null;

const getRequestTransaction = () => {
    const context = getRequestContext();
    return context?.trx || null;
};

module.exports = {
    runWithRequestContext,
    getRequestContext,
    getRequestTransaction,
};
