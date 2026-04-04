require('dotenv').config()

const ADMIN_IDS = process.env.ADMIN_IDS
  ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim()))
  : []

function isAdmin(userId) {
  return ADMIN_IDS.includes(userId)
}
