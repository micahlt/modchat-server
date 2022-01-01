const ScratchLib = require("scratchlib")
const User = require("./models/user.js")
const userList = []

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
      if(!userList.includes(username)) {
      userList.push({
        room: room,
        name: username,
        scratch_picture: data.profile.images["60x60"],
        })
      }
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
  }).lean()
  return user
}

// User leaves chat
function userLeave(username) {
 userList.splice(userList.indexOf(username) + 1, 1)
}

module.exports = {
  userJoin,
  getCurrentUser,
  userLeave,
  userList,
}
