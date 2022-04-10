const mongoose = require("mongoose")

const MessageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  message: { type: String, required: true },
  profile_picture: { type: String, required: true },
  time: { type: Date, required: true },
  id: { type: Number, required: true },
  room: { type: String, required: true },
  reply_id: { type: Number, required: false },
  reported: { type: Boolean, required: false },
})

const model = mongoose.model("MessageSchema", MessageSchema)

module.exports = model
