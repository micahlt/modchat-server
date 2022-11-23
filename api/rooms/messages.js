const express = require("express")
const router = express.Router()

const Message = require("../../models/message.js")

// Finds a single message by ID
router.get("/api/messages/:room/:id", (req, res) => {
  const room = req.params.room
  const id = req.params.id
  if (String(room) && Number(id)) {
    Message.find({
      room: room,
      id: id,
    }).then((msg) => {
      if (JSON.stringify(msg) == "[]") {
        res.status(404).send("Couldn't find anything that matched.")
      } else {
        res.status(200).send(msg[0])
      }
    })
  } else {
    res.sendStatus(400)
  }
})

// Finds multiple messages
router.get("/api/messages/:room", (req, res) => {
  const room = req.params.room
  const first = req.query.first
  const last = req.query.last
  if (room && first && last && String(room) && Number(first) && Number(last)) {
    Message.find({
      room: room,
      id: {
        $gte: first,
        $lte: last,
      },
    })
      .sort({ id: "asc" })
      .then((msg) => {
        if (JSON.stringify(msg) == "[]") {
          res.status(204).send(msg)
        } else {
          res.status(200).send(msg)
        }
      })
  } else {
    res.sendStatus(400)
  }
})

module.exports = router
