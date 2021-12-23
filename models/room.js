const mongoose = require("mongoose")

const RoomSchema = new mongoose.Schema({
  messages: [
    {
      username: { type: String, required: true },
      message: { type: String, required: true },
      profile_picture: { type: String, required: true },
      time: { type: Number, required: true },
      message_id: { type: Number, required: true },
    },
  ],
  name: String,
  message_id: Number,
})

const model = mongoose.model("RoomSchema", RoomSchema)

module.exports = model
