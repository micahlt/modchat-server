const ScratchLib = require("scratchlib")
const User = require("./models/user.js")
let userList = []

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
async function getCurrentUser(username) {
  const user = await User.findOne({
    username: username
  }).lean()
  return user
}

// User leaves chat
function userLeave(username) {
  console.log(`🔎 looking for ${username} in MongoDB`)
  let index = userList.findIndex((u) => {
    return u.name == username
  })
  userList.splice(index, 1)
  if (index != -1) {
    console.log("✅ Removed user from online list at index ", index)
  }
}

module.exports = {
  userJoin,
  getCurrentUser,
  userLeave,
  userList,
}
