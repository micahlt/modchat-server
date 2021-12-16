const ScratchLib = require("scratchlib");
const User = require("./models/user.js");
let userList = [];

// Join user to chat
function userJoin(socket, username, room) {
  ScratchLib.getProfile(username).then((data) => {
    User.updateOne(
      {
        username: username,
      },
      {
        $set: {
          socket_id: socket,
          room: room,
          scratch_picture: data.profile.images["60x60"],
          status: "online",
        },
      }
    ).then(() => {
      userList.push({
        room: room,
        name: username
      });
      User.findOne(
        {
          username: username,
        },
        (err, doc) => {
          return doc
        }
      )
    })
  })
}

// Get current user
async function getCurrentUser(socket_id) {
  const user = await User.findOne({
    socket_id: socket_id,
  }).lean();
  return user;
}

// User leaves chat
async function userLeave(socket) {
  const user = await User.findOneAndUpdate({
      socket_id: socket,
    },
    {
      status: "offline"
    }).lean();
  console.log("User is leaving.");
  return;
}

module.exports = {
  userJoin,
  getCurrentUser,
  userLeave,
  userList
}
