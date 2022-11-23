const fetch = require("node-fetch") // Not required with Node V18 and beyond
const User = require("../models/user.js")

// Join user to chat
async function userJoin(socket, username, room) {
  if (username && String(username)) {
    // fallback
    let url = `https://api.scratch.mit.edu/users/${username}`
    let req = await fetch(url)
    let data = await req.json()
    if ("response" in data) {
      console.log("Fallbacking to ScratchDB. Are you on replit?")
      let url = `https://scratchdb.lefty.one/v3/user/info/${username}`
      let req = await fetch(url)
      data = await req.json()
    }
    const picture = `https://cdn2.scratch.mit.edu/get_image/user/${data.id}_60x60.png?v=`
    if (data) {
      await User.updateOne(
        {
          username: username,
        },
        {
          $set: {
            room: room,
            scratch_picture: picture,
          },
        }
      ).then(() => {
        User.findOne(
          {
            username: username,
          },
          (err, doc) => {
            return doc
          }
        )
      })
    }
  }
}

module.exports = {
  userJoin,
}
