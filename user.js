const ScratchLib = require("scratchlib");
let db = require('./db');
const users = [];

// Join user to chat
function userJoin(id, username, room, token) {
  let user = {};
  db.findOne({username:username}, (err, doc) => {
    if (doc) {
      if (doc.token == token) {
        ScratchLib.getProfile(username).then((data) => {
          user = {
            id,
            username,
            room,
            pic: data.profile.images['60x60'],
            token: token,
            status: 'online'
          };
          db.insert(user);
        })
      } else {
        console.log('Token should be '.red + doc.token)
      }
    }
  })
}

// Get current user
function getCurrentUser(id) {
  return db.findOne({id:id}, (err, doc) => {
    return doc;
  });
}

// User leaves chat
function userLeave(id) {
  db.update({id:id}, {$set: {status: 'offline'}});
    console.log('User is leaving.')
    return;
}

module.exports = {
  userJoin,
  getCurrentUser,
  userLeave
};
