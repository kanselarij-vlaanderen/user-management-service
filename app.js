import mu from 'mu';

const formDataParser = require('./repository/parse-form-data.js');
const csvParser = require('./repository/index.js');
const userHelpers = require('./repository/user-helpers.js');

const app = mu.app;

app.post('/import-users', async (req, res) => {
  const formData = await formDataParser.parseFormData(req);
  if (!formData || !formData.file) {
    throw new Error('No file uploaded');
  }

  const file = formData.file;
  const parsedUsers = await csvParser.processCsvUsersFileFromPath(file.path);
  const reducedRoles = createUniqueHashOfRolesWithUsers(parsedUsers);
  const createdUsers = await Promise.all(
    Object.keys(reducedRoles).map(async (role) => {
      const groups = await userHelpers.getGroupsByLabel(role);
      const foundGroup = groups[0];
      if (foundGroup) {
        const groupUri = foundGroup.group;
        const roleObject = reducedRoles[role];
        roleObject.groupUri = groupUri;
        return userHelpers.ensureUserAndAccount(roleObject);
      }
    })
  );
  res.send({ status: 200, body: { createdUsers } });
});

const createUniqueHashOfRolesWithUsers = (users) => {
  return users.reduce((users, user) => {
    const userRole = (user.role || '').toLowerCase();
    users[userRole] = users[userRole] || { role: userRole, usersToAdd: [] };
    users[userRole].usersToAdd.push(user);
    return users;
  }, {});
};
