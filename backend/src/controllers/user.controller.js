const { createUserSchema, updateUserSchema, listUsersSchema, statusSchema, idSchema } = require('../validators/user.validator');
const userService = require('../services/user.service');

async function create(req, res) {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });

  try {
    const user = await userService.createUser(parsed.data);
    return res.status(201).json({ user });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'El email ya está registrado' });
    }
    throw error;
  }
}

async function list(req, res) {
  const parsed = listUsersSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });
  return res.json(await userService.listUsers(parsed.data));
}

async function get(req, res) {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: 'Datos inválidos' });
  const user = await userService.getUser(id.data);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  return res.json({ user });
}

async function update(req, res) {
  const id = idSchema.safeParse(req.params.id);
  const body = updateUserSchema.safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ message: 'Datos inválidos' });
  try {
    return res.json({ user: await userService.updateUser(id.data, body.data) });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'El email ya está registrado' });
    if (error.code === 'P2025') return res.status(404).json({ message: 'Usuario no encontrado' });
    throw error;
  }
}

async function setStatus(req, res) {
  const id = idSchema.safeParse(req.params.id);
  const body = statusSchema.safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ message: 'Datos inválidos' });

  if (req.user.id === id.data && body.data.isActive === false) {
    return res.status(400).json({ message: 'No puedes desactivar tu propia cuenta' });
  }

  try {
    const user = await userService.setStatus(id.data, body.data.isActive);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.json({ user });
  } catch (error) {
    // Si otra operación eliminó al usuario entre la búsqueda y el update.
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    throw error;
  }
}

module.exports = { create, list, get, update, setStatus };
