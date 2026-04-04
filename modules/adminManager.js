const { Markup } = require('telegraf')
const db = require('./database')
const { sendSms } = require('./sms')
const { isAdmin } = require('./roles')

const TEMPLATES = {
  dars_kelm: (name) => `Hurmatli ota-ona! ${name} bugun darsga kelmadi. Iltimos, sababini bildiring yoki nazoratingizga oling.`,
  kech_qoldi: (name) => `Hurmatli ota-ona! ${name} bugun darsga kech qoldi. Iltimos, e'tiboringizga oling.`,
  vazifa: (name) => `Hurmatli ota-ona! ${name} uyga vazifani bajarmay keldi. Iltimos, farzandingizni nazorat qiling.`,
}

const state = new Map()

function register(bot) {
  bot.command('admin', ctx => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('⛔ Ruxsat yo\'q.')
    ctx.reply(
      '🏫 <b>Admin Panel</b>\n\n' +
      '📨 /notify — Xabar yuborish\n' +
      '👤 /addstudent — O\'quvchi qo\'shish\n' +
      '📋 /students — Ro\'yxat\n' +
      '🔍 /search — Qidirish\n' +
      '🗑 /deletestudent <id> — O\'chirish',
      { parse_mode: 'HTML' }
    )
  })

  bot.command('notify', ctx => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('⛔ Ruxsat yo\'q.')
    state.set(ctx.from.id, { step: 'search' })
    ctx.reply('🔍 O\'quvchining ismini yozing:')
  })

  bot.command('search', ctx => {
    if (!isAdmin(ctx.from.id)) return
    state.set(ctx.from.id, { step: 'search' })
    ctx.reply('🔍 Qidirish so\'zini yuboring (ism yoki sinf):')
  })

  bot.action(/^sel:(\d+)$/, async ctx => {
    const studentId = parseInt(ctx.match[1])
    const student = db.getStudentById(studentId)
    if (!student) return ctx.answerCbQuery('Topilmadi')

    state.set(ctx.from.id, { step: 'selectTemplate', studentId })

    const tgInfo = student.parent_tg_id
      ? `✅ Telegram: ${student.parent_username ? '@' + student.parent_username : 'ID:' + student.parent_tg_id}`
      : '❌ Telegram: ulanmagan'
    const smsInfo = student.parent_phone
      ? `📱 SMS: ${student.parent_phone}`
      : '❌ SMS: raqam yo\'q'

    await ctx.editMessageText(
      `👤 <b>${student.full_name}</b> — ${student.class_name || '?'}\n${tgInfo}\n${smsInfo}\n\n📨 Xabar turini tanlang:`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📌 Darsga kelmadi', `tmpl:dars_kelm:${studentId}`)],
          [Markup.button.callback('⚠️ Kech qoldi', `tmpl:kech_qoldi:${studentId}`)],
          [Markup.button.callback('📝 Vazifa bajarilmadi', `tmpl:vazifa:${studentId}`)],
          [Markup.button.callback('✏️ O\'z xabarimni yozaman', `tmpl:custom:${studentId}`)],
        ])
      }
    )
    ctx.answerCbQuery()
  })

  bot.action(/^tmpl:(\w+):(\d+)$/, async ctx => {
    const tmplKey = ctx.match[1]
    const studentId = parseInt(ctx.match[2])
    const student = db.getStudentById(studentId)

    if (tmplKey === 'custom') {
      state.set(ctx.from.id, { step: 'writeMessage', studentId })
      await ctx.editMessageText(
        `✏️ <b>${student.full_name}</b> uchun xabaringizni yozing:`,
        { parse_mode: 'HTML' }
      )
      ctx.answerCbQuery()
      return
    }

    const msgText = TEMPLATES[tmplKey](student.full_name)
    state.set(ctx.from.id, { step: 'confirm', studentId, message: msgText })
    await showConfirm(ctx, student, msgText, true)
    ctx.answerCbQuery()
  })

  bot.action('confirm:yes', async ctx => {
    const s = state.get(ctx.from.id)
    if (!s || s.step !== 'confirm') return ctx.answerCbQuery()
    await doSend(ctx, s.studentId, s.message)
    state.delete(ctx.from.id)
  })

  bot.action('confirm:no', async ctx => {
    state.delete(ctx.from.id)
    await ctx.editMessageText('❌ Bekor qilindi.')
    ctx.answerCbQuery()
  })

  return state
}

async function showConfirm(ctx, student, msgText, edit = false) {
  const tgOk = student.parent_tg_id ? '✅ Telegram' : '❌ Telegram (ulanmagan)'
  const smsOk = student.parent_phone ? `✅ SMS (${student.parent_phone})` : '❌ SMS (raqam yo\'q)'

  const text =
    `📬 <b>Tasdiqlash</b>\n\n` +
    `👤 Kimga: <b>${student.full_name}</b>\n` +
    `📤 Kanallar:\n  ${tgOk}\n  ${smsOk}\n\n` +
    `💬 Xabar:\n<i>${msgText}</i>`

  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Ha, yuborish', 'confirm:yes')],
    [Markup.button.callback('❌ Bekor qilish', 'confirm:no')],
  ])

  if (edit) {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...kb })
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', ...kb })
  }
}

async function doSend(ctx, studentId, msgText) {
  const student = db.getStudentById(studentId)
  await ctx.editMessageText('⏳ Yuborilmoqda...')

  let sentTg = false
  let sentSms = false
  const results = []

  if (student.parent_tg_id) {
    try {
      await ctx.telegram.sendMessage(
        student.parent_tg_id,
        `🔔 <b>Maktab xabarnomasi</b>\n\n${msgText}`,
        { parse_mode: 'HTML' }
      )
      sentTg = true
      results.push('✅ Telegram: yuborildi')
    } catch (e) {
      results.push(`❌ Telegram: xato (${e.message})`)
    }
  } else {
    results.push('⏭ Telegram: ulanmagan')
  }

  if (student.parent_phone) {
    const ok = await sendSms(student.parent_phone, msgText)
    sentSms = ok
    results.push(ok ? '✅ SMS: yuborildi' : '❌ SMS: xato')
  } else {
    results.push('⏭ SMS: raqam yo\'q')
  }

  db.logNotification(studentId, msgText, sentTg, sentSms)

  await ctx.editMessageText(
    `📊 <b>Natija:</b>\n\n${results.join('\n')}\n\n` +
    `👤 <b>${student.full_name}</b> ga xabar yuborildi.`,
    { parse_mode: 'HTML' }
  )
}

module.exports = { register, state, doSend, showConfirm }
