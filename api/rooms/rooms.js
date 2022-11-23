const express = require("express")
const router = express.Router()

const Room = require("../../models/room.js")

// Gets room data by room name
router.get("/api/rooms/:room?", (req, res) => {
  const room = req.params.room
  if (room) {
    Room.find({
      name: room,
    }).then((rm) => {
      if (JSON.stringify(rm) == "[]") {
        res.sendStatus(400)
      } else {
        res.status(200).send(rm[0])
      }
    })
  } else {
    res.sendStatus(400)
  }
})

module.exports = router
