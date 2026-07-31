require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');

const indexRoutes = require('./src/routes/index');
const pedidosRoutes = require('./src/routes/pedidos');
const pagamentosRoutes = require('./src/routes/pagamentos');
const produtosRoutes = require('./src/routes/produtos');
const fornecedoresRoutes = require('./src/routes/fornecedores');
const desembaracoRoutes = require('./src/routes/desembaraco');
const analisesRoutes = require('./src/routes/analises');
const authRoutes = require('./src/routes/auth');
const usuariosRoutes = require('./src/routes/usuarios');
const configuracoesRoutes = require('./src/routes/configuracoes');
const { notFound, errorHandler } = require('./src/middlewares/errorHandler');
const {
  loadUser,
  requireAuth,
  requirePermissao,
} = require('./src/middlewares/auth');
const { temPermissao, MODULOS, primeiraRotaPermitida } = require('./src/constants/permissoes');
const {
  moneyBrl,
  moneyUsd,
  numberBr,
  percentBr,
  formatInputBr,
  formatDateBr,
  addDaysIso,
  statusPedidoLabel,
  statusPedidoBadgeClass,
  STATUS_PEDIDO,
  formatCnpj,
  formatCep,
} = require('./src/utils/format');

const app = express();
const port = Number(process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.locals.moneyBrl = moneyBrl;
app.locals.moneyUsd = moneyUsd;
app.locals.numberBr = numberBr;
app.locals.percentBr = percentBr;
app.locals.formatInputBr = formatInputBr;
app.locals.formatDateBr = formatDateBr;
app.locals.addDaysIso = addDaysIso;
app.locals.statusPedidoLabel = statusPedidoLabel;
app.locals.statusPedidoBadgeClass = statusPedidoBadgeClass;
app.locals.STATUS_PEDIDO = STATUS_PEDIDO;
app.locals.formatCnpj = formatCnpj;
app.locals.formatCep = formatCep;
app.locals.MODULOS = MODULOS;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'paulo-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
    },
  })
);

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.currentUrl = req.originalUrl;
  res.locals.temPermissao = (modulo) => temPermissao(res.locals.user, modulo);
  res.locals.homePath = () => primeiraRotaPermitida(res.locals.user) || '/';
  next();
});

app.use(loadUser);
app.use(authRoutes);
app.use(requireAuth);

app.use('/', indexRoutes);
app.use('/pedidos', requirePermissao('pedidos'), pedidosRoutes);
app.use('/pagamentos', requirePermissao('pagamentos'), pagamentosRoutes);
app.use('/produtos', requirePermissao('produtos'), produtosRoutes);
app.use('/fornecedores', requirePermissao('fornecedores'), fornecedoresRoutes);
app.use('/saldo', requirePermissao('saldo'), require('./src/routes/saldo'));
app.use('/desembaraco', requirePermissao('desembaraco'), desembaracoRoutes);
app.use('/analises', requirePermissao('analises'), analisesRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/configuracoes', configuracoesRoutes);

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
