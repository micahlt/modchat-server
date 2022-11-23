const verifyRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.sendStatus(403)
    const rolesArray = [...allowedRoles]
    const role = req.user.role
    if (!rolesArray.includes(role)) return res.sendStatus(401)
    next()
  }
}

module.exports = verifyRoles
