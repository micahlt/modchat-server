const mongoose = require("mongoose")

const RoomSchema = new mongoose.Schema({
  messages: [
    {
      message_id: Number,
    },
  ],
  name: String,
})

const model = mongoose.model("RoomSchema", RoomSchema)

module.exports = model
