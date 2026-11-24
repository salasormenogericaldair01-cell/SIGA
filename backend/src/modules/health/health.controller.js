function getHealth(req, res) {
  const candidate = [process.env.BUILD_SHA, process.env.RENDER_GIT_COMMIT]
    .find((value) => typeof value === 'string' && /^[0-9a-f]{7,40}$/i.test(value));
  res.status(200).json({
    status: 'ok',
    service: 'sistema-gestion-academica-api',
    version: candidate ? candidate.slice(0, 8).toLowerCase() : 'unknown',
  });
}

module.exports = { getHealth };
