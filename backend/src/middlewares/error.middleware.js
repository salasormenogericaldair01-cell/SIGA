function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // Errores del parser JSON: no devolver el cuerpo ni el mensaje original.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'JSON inválido' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Cuerpo de solicitud demasiado grande' });
  }

  // Registrar solo el tipo: los mensajes de errores externos podrían incluir secretos.
  console.error('Error interno:', err.code || err.name || 'desconocido');
  return res.status(500).json({ message: 'Error interno del servidor' });
}

module.exports = errorHandler;
