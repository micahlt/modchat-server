const ScratchLib = require("scratchlib");
let db = require('./db');

// Join user to chat
function userJoin(socket, username, room) {
  let toReturn;
  ScratchLib.getProfile(username).then((data) => {
    db.update({
      username: username
    }, {
      $set: {
        socket: socket,
        room: room,
        pic: data.profile.images['60x60'],
        status: 'online'
      }
    })
    db.findOne({
      socket: socket
    }, (err, doc) => {
      doc.password = '[REDACTED]'
      // console.log(doc)
      toReturn = doc;
    });
    return toReturn;
  })
}

// Get current user
function getCurrentUser(socket) {
  let toReturn;
  setTimeout(() => {
    db.findOne({
      socket: socket
    }, (err, doc) => {
      // console.log(doc)
      toReturn = doc;
    });
  }, 300)
  return toReturn;
}

// User leaves chat
function userLeave(socket) {
  db.update({
    socket: socket
  }, {
    $set: {
      status: 'offline'
    }
  });
  console.log('User is leaving.')
  return;
}

module.exports = {
  userJoin,
  getCurrentUser,
  userLeave
};