const Usuario = require('../models/Usuario');

function index(req, res) {
  res.render('configuracoes/index', {
    title: 'Configurações',
  });
}

function listarSenha(req, res, next) {
  Usuario.listar()
    .then((usuarios) => {
      res.render('configuracoes/senha', {
        title: 'Renovação de senha',
        usuarios,
      });
    })
    .catch(next);
}

module.exports = {
  index,
  listarSenha,
};
