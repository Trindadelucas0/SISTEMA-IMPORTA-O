require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');

const indexRoutes = require('./src/routes/index');
const pedidosRoutes = require('./src/routes/pedidos');
const pagamentosRoutes = require('./src/routes/pagamentos');
const desembaracoRoutes = require('./src/routes/desembaraco');
const { notFound, errorHandler } = require('./src/middlewares/errorHandler');
const { moneyBrl, moneyUsd, numberBr, percentBr } = require('./src/utils/format');

const app = express();
const port = Number(process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.locals.moneyBrl = moneyBrl;
app.locals.moneyUsd = moneyUsd;
app.locals.numberBr = numberBr;
app.locals.percentBr = percentBr;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'paulo-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

app.use('/', indexRoutes);
app.use('/pedidos', pedidosRoutes);
app.use('/pagamentos', pagamentosRoutes);
app.use('/saldo', require('./src/routes/saldo'));
app.use('/desembaraco', desembaracoRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  const { ensureDatabase } = require('./src/config/ensureDb');
  await ensureDatabase();

  const server = app.listen(port);

  server.on('listening', () => {
    console.log(`Servidor em http://localhost:${port}`);
    console.log(`PID ${process.pid} — deixe este terminal aberto (Ctrl+C para parar).`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Porta ${port} já está em uso.`);
      console.error('Libere e suba de novo no PowerShell:');
      console.error(
        `  Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
      );
      console.error('  node server.js');
    } else {
      console.error('Falha ao iniciar o servidor:', err);
    }
    process.exit(1);
  });
}

start().catch((err) => {
  console.error('Falha ao preparar banco:', err);
  process.exit(1);
});
