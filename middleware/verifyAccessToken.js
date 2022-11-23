async function verifyAccessToken(req, res, next) {
  const accessToken = req.body.access_token
  if (!accessToken) return res.sendStatus(401)
  console.log(accessToken)
  const oldUser = await User.find({
    "tokens.access_token": accessToken,
  }).exec()
  const user = oldUser[0]
  if (!user) return res.sendStatus(401)
  const foundToken = user.tokens.filter(
    (tokenArray) => accessToken === tokenArray.access_token
  )
  if (!foundToken[0]) return res.sendStatus(401)
  if (
    foundToken[0].access_token === accessToken &&
    Date.now() < foundToken[0].access_expiry
  ) {
    req.user = user
    next()
  } else {
    res.sendStatus(401)
  }
}

module.exports = verifyAccessToken
