function notFound(req, res) {
  res.status(404).render('errors/404', {
    title: 'Página não encontrada',
    message: 'Esse endereço não existe no sistema.',
    pathTried: req.originalUrl,
  });
}

function errorHandler(err, req, res, _next) {
  console.error(err);
  res.status(500).render('errors/500', {
    title: 'Erro interno',
    message: process.env.NODE_ENV === 'production'
      ? 'Ocorreu um erro inesperado.'
      : err.message,
  });
}

module.exports = { notFound, errorHandler };
