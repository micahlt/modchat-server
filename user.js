const ScratchLib = require("scratchlib");
const users = [];

// Join user to chat
function userJoin(id, username, room) {
  let user = {};
  ScratchLib.getProfile(username).then((data) => {
    user = {
      id,
      username,
      room,
      pic: data.profile.images['60x60']
    };
    users.push(user);
    console.log("user out", users);
  })
  return user;
}

// Get current user
function getCurrentUser(id) {
  return users.find((user) => user.id === id);
}

// User leaves chat
function userLeave(id) {
  const index = users.findIndex((user) => user.id === id);

  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
  console.log(users);
}

module.exports = {
  userJoin,
  getCurrentUser,
  userLeave
};