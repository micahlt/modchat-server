const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String },
    role: { type: String },
    scratch_picture: { type: String },
    socket_id: { type: String },
    room: { type: String },
    status: { type: String },
  },
  { strict: false }
)

const model = mongoose.model("UserSchema", UserSchema)

module.exports = model
