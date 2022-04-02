const mongoose = require("mongoose")

const MessageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  message: { type: String, required: true },
  profile_picture: { type: String, required: true },
  time: { type: Date, required: true },
  id: { type: Number, required: true },
  room: { type: String, required: true },
})

const model = mongoose.model("MessageSchema", MessageSchema)

module.exports = model
