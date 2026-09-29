function getHealth(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'sistema-gestion-academica-api',
  });
}

module.exports = { getHealth };
