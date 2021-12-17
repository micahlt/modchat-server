const mongoose = require("mongoose")

const MiscSchema = new mongoose.Schema({
  message_id: Number,
})

const model = mongoose.model("MiscSchema", MiscSchema)

module.exports = model
