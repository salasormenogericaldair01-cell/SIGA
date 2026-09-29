const { loginSchema } = require('../validators/user.validator');
const authService = require('../services/auth.service');

async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });

  const result = await authService.login(parsed.data);
  if (!result) return res.status(401).json({ message: 'Credenciales inválidas' });

  return res.json(result);
}

function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { login, me };
