const mongoose = require("mongoose")

const RoomSchema = new mongoose.Schema({
  name: String,
  current_message_id: Number,
})

const model = mongoose.model("RoomSchema", RoomSchema)

module.exports = model
