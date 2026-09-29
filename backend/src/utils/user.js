const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
};

const adminUserSelect = {
  ...publicUserSelect,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };
}

function adminUser(user) {
  return {
    ...publicUser(user),
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

module.exports = { publicUserSelect, adminUserSelect, publicUser, adminUser };
