const mongoose = require("mongoose")

const MessageSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    message: { type: String, required: true },
    profile_picture: { type: String, required: true },
    time: { type: Number, required: true },
    message_id: { type: Number, required: true },
  },
  { collection: "messages" }
)

const model = mongoose.model("MessageSchema", MessageSchema)

module.exports = model
