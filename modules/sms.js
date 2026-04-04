require('dotenv').config()
const axios = require('axios')

const LOGIN = process.env.PLAYMOBILE_LOGIN
const PASSWORD = process.env.PLAYMOBILE_PASSWORD
const ORIGINATOR = process.env.PLAYMOBILE_ORIGINATOR || 'Maktab'
const URL = 'http://91.204.239.44/broker-api/send'

async function sendSms(phone, message) {
  let cleanPhone = phone.replace(/\D/g, '')
  if (!cleanPhone.startsWith('998')) {
    cleanPhone = '998' + cleanPhone.replace(/^0+/, '')
  }

  const credentials = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64')

  const payload = {
    messages: [
      {
        recipient: cleanPhone,
        'message-id': `msg_${cleanPhone}_${Date.now()}`,
        sms: {
          originator: ORIGINATOR,
          content: { text: message },
        },
      },
    ],
  }

  try {
    const res = await axios.post(URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      timeout: 10000,
    })
    console.log(`SMS yuborildi [${res.status}]:`, res.data)
    return res.status === 200
  } catch (err) {
    console.error('SMS xatosi:', err.message)
    return false
  }
}

module.exports = { sendSms }
