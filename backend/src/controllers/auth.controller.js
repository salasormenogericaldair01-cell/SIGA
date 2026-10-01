const { loginSchema, changePasswordSchema } = require('../validators/user.validator');
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

async function changePassword(req, res) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });

  const result = await authService.changePassword(
    req.user.id, req.tokenVersion, parsed.data.currentPassword, parsed.data.newPassword,
  );
  if (result === 'invalid-current') return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
  if (result === 'stale-session') return res.status(401).json({ message: 'No autorizado' });
  return res.json({ message: 'Contraseña actualizada. Inicia sesión nuevamente.' });
}

module.exports = { login, me, changePassword };
