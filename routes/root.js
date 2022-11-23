const VERSION = "0.9.0"

const express = require("express")
const router = express.Router()

router.get("^/$|/index(.html)?", (req, res) => {
  res.send(`🏁 modchat-server ${VERSION} is running`)
})

module.exports = router
