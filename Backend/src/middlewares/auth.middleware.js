const jwt = require("jsonwebtoken")
const tokenBlacklistModel = require("../models/blacklist.model")

async function authUser(req, res, next) {
    const authHeader = req.headers?.authorization
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null
    const token = req.cookies?.token || bearerToken

    if (!token) {
        return res.status(401).json({
            message: "Token not provided. Please log in."
        })
    }

    try {
        const isTokenBlacklisted = await tokenBlacklistModel.findOne({ token })

        if (isTokenBlacklisted) {
            return res.status(401).json({
                message: "Token is invalid or expired."
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret_key")
        req.user = decoded

        next()
    } catch (err) {
        return res.status(401).json({
            message: "Invalid or expired token."
        })
    }
}

module.exports = {
    authUser
}