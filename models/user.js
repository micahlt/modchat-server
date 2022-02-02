const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String },
  scratch_picture: { type: String },
  room: { type: String },
  banned: { type: Boolean },
  ban_reason: { type: String },
  ban_expiry: { type: Number },
  tokens: [
    {
      access_token: { type: String },
      refresh_token: { type: String },
      access_expiry: { type: Number },
      refresh_expiry: { type: Number },
    },
  ],
})
{
  strict: false
}

const model = mongoose.model("UserSchema", UserSchema)

module.exports = model
