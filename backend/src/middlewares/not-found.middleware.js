function notFound(req, res) {
  res.status(404).json({ message: 'Ruta no encontrada' });
}

module.exports = notFound;
