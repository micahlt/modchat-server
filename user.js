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
      userList.push({
        room: room,
        name: username,
        scratch_picture: data.profile.images["60x60"],
      })
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
async function userLeave(socket, username, room) {
  const user = await User.findOneAndUpdate(
    {
      socket_id: socket,
    },
    {
      status: "offline",
    }
  )
    .lean()
    .then(() => {
      userList.splice(userList.indexOf(username) + 1, 1)
    })
  return
}

module.exports = {
  userJoin,
  getCurrentUser,
  userLeave,
  userList,
}
