const express = require('express');
const app = express();
app.use('/api/investments', require('./routes/investmentRoutes'));
const routes = app._router.stack.filter(r => r.name === 'router')[0].handle.stack.map(r => r.route ? r.route.path + ' ' + Object.keys(r.route.methods) : r.regexp);
console.log(routes);
