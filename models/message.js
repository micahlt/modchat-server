const mongoose = require("mongoose")

const MessageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  message: { type: String, required: true },
  profile_picture: { type: String, required: true },
  time: { type: Date, required: true },
  id: { type: Number, required: true },
  room: { type: String, required: true },
<<<<<<< HEAD
=======
  reply_id: { type: Number, required: false },
  reported: { type: Boolean, required: false}
>>>>>>> ca9f7ec... Add error handling, make authentication more robust, fix bugs, add reporting, change password feature, and more
})

const model = mongoose.model("MessageSchema", MessageSchema)

module.exports = model
