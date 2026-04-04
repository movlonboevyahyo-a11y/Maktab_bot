const { Markup } = require('telegraf')
const db = require('./database')

const state = new Map()

function register(bot) {
  bot.start(ctx => {
    const parent = db.getParentByTgId(ctx.from.id)
    if (parent) {
      return ctx.reply(
        `✅ Siz allaqachon ro\'yxatdan o\'tgansiz!\n\n` +
        `👤 Ism: <b>${parent.full_name}</b>\n` +
        `📱 Tel: <b>${parent.phone}</b>\n\n` +
        `Yangilash uchun /register yuboring.`,
        { parse_mode: 'HTML' }
      )
    }
    state.set(ctx.from.id, { step: 'studentName' })
    ctx.reply(
      '👋 <b>Maktab xabarnomalar botiga xush kelibsiz!</b>\n\n' +
      'Farzandingizning <b>to\'liq ismini</b> yuboring:',
      { parse_mode: 'HTML' }
    )
  })

  bot.command('register', ctx => {
    state.set(ctx.from.id, { step: 'studentName' })
    ctx.reply('Farzandingizning <b>to\'liq ismini</b> yuboring:', { parse_mode: 'HTML' })
  })

  return state
}

module.exports = { register, state }
