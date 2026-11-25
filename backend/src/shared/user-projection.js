const publicUserAttributes = ['id', 'email', 'firstName', 'lastName', 'role'];

const adminUserAttributes = [
  ...publicUserAttributes,
  'isActive',
  'createdAt',
  'updatedAt',
];

function plain(record) {
  return record && typeof record.get === 'function' ? record.get({ plain: true }) : record;
}

function publicUser(user) {
  const row = plain(user);
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role,
  };
}

function adminUser(user) {
  const row = plain(user);
  return {
    ...publicUser(row),
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

module.exports = {
  publicUserAttributes,
  adminUserAttributes,
  publicUser,
  adminUser,
};
