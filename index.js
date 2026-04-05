require('dotenv').config()
const { Telegraf, Markup } = require('telegraf')
const db = require('./modules/database')
const { isAdmin } = require('./modules/roles')

const adminManager = require('./modules/adminManager')
const studentModule = require('./modules/student')
const oquvchiModule = require('./modules/oquvchi')

async function main() {
  await db.init()

  const bot = new Telegraf(process.env.BOT_TOKEN)

  adminManager.register(bot)
  studentModule.register(bot)
  oquvchiModule.register(bot)

  bot.on('text', async ctx => {
    const userId = ctx.from.id
    const text = ctx.message.text.trim()

    const adminState = adminManager.state.get(userId)
    if (adminState && isAdmin(userId)) {
      if (adminState.step === 'search') {
        const students = db.searchStudents(text)
        if (!students.length) {
          return ctx.reply('❌ Topilmadi. Qayta urinib ko\'ring:')
        }
        const buttons = students.slice(0, 8).map(s => {
          const tg = s.parent_tg_id ? '✅' : '❌'
          const sms = s.parent_phone ? '📱' : '—'
          return [Markup.button.callback(
            `${s.full_name} | ${s.class_name || '?'} | TG:${tg} SMS:${sms}`,
            `sel:${s.id}`
          )]
        })
        adminManager.state.set(userId, { step: 'selectStudent' })
        return ctx.reply('👇 O\'quvchini tanlang:', Markup.inlineKeyboard(buttons))
      }

      if (adminState.step === 'writeMessage') {
        const student = db.getStudentById(adminState.studentId)
        adminManager.state.set(userId, {
          step: 'confirm',
          studentId: adminState.studentId,
          message: text
        })
        return adminManager.showConfirm(ctx, student, text, false)
      }
    }

    const studentState = studentModule.state.get(userId)
    if (studentState && isAdmin(userId)) {
      if (studentState.step === 'name') {
        studentModule.state.set(userId, { action: 'addStudent', step: 'class', name: text })
        return ctx.reply('🏫 <b>Sinfini</b> kiriting (masalan: 9-A):', { parse_mode: 'HTML' })
      }
      if (studentState.step === 'class') {
        studentModule.state.set(userId, { ...studentState, step: 'phone', className: text })
        return ctx.reply(
          '📱 Ota-ona telefon raqamini kiriting (+998XXXXXXXXX)\n' +
          'O\'tkazib yuborish uchun: /skip'
        )
      }
      if (studentState.step === 'phone') {
        const id = db.addStudent(studentState.name, studentState.className, text)
        studentModule.state.delete(userId)
        return ctx.reply(
          `✅ <b>O\'quvchi qo\'shildi!</b>\n\n` +
          `🆔 ID: <code>${id}</code>\n` +
          `👤 Ism: <b>${studentState.name}</b>\n` +
          `🏫 Sinf: <b>${studentState.className}</b>\n` +
          `📱 Tel: <b>${text}</b>`,
          { parse_mode: 'HTML' }
        )
      }
    }

    const parentState = oquvchiModule.state.get(userId)
    if (parentState) {
      if (parentState.step === 'studentName') {
        const students = db.searchStudents(text)
        if (!students.length) {
          return ctx.reply('❌ Bunday o\'quvchi topilmadi. Qayta urinib ko\'ring:')
        }
        if (students.length === 1) {
          const s = students[0]
          oquvchiModule.state.set(userId, { step: 'phone', studentId: s.id, studentName: s.full_name })
          return ctx.reply(
            `✅ <b>${s.full_name}</b> topildi!\n\nTelefon raqamingizni yuboring:`,
            {
              parse_mode: 'HTML',
              ...Markup.keyboard([
                [Markup.button.contactRequest('📱 Raqamimni yuborish')]
              ]).resize().oneTime()
            }
          )
        }
        const buttons = students.slice(0, 6).map(s =>
          [Markup.button.callback(`${s.full_name} (${s.class_name})`, `psel:${s.id}`)]
        )
        oquvchiModule.state.set(userId, { step: 'selectStudent' })
        return ctx.reply('Bir nechta topildi, to\'g\'risini tanlang:', Markup.inlineKeyboard(buttons))
      }

      if (parentState.step === 'phone') {
        const phone = text.replace(/\s/g, '')
        if (!phone.match(/^\+?998\d{9}$/)) {
          return ctx.reply('❌ Noto\'g\'ri format. Misol: +998901234567')
        }
        await finishParentReg(ctx, userId, phone)
      }
    }
  })

  bot.action(/^psel:(\d+)$/, async ctx => {
    const studentId = parseInt(ctx.match[1])
    const student = db.getStudentById(studentId)
    oquvchiModule.state.set(ctx.from.id, { step: 'phone', studentId, studentName: student.full_name })
    await ctx.editMessageText(
      `✅ <b>${student.full_name}</b> tanlandi!\n\nTelefon raqamingizni yuboring:`,
      { parse_mode: 'HTML' }
    )
    await ctx.reply(
      'Tugmani bosing yoki qo\'lda kiriting:',
      Markup.keyboard([[Markup.button.contactRequest('📱 Raqamimni yuborish')]]).resize().oneTime()
    )
    ctx.answerCbQuery()
  })

  bot.on('contact', async ctx => {
    const userId = ctx.from.id
    const parentState = oquvchiModule.state.get(userId)
    if (!parentState || parentState.step !== 'phone') return
    await finishParentReg(ctx, userId, ctx.message.contact.phone_number)
  })

  bot.command('skip', ctx => {
    if (!isAdmin(ctx.from.id)) return
    const s = studentModule.state.get(ctx.from.id)
    if (s && s.step === 'phone') {
      const id = db.addStudent(s.name, s.className, null)
      studentModule.state.delete(ctx.from.id)
      ctx.reply(
        `✅ <b>O\'quvchi qo\'shildi!</b>\n\n` +
        `🆔 ID: <code>${id}</code>\n` +
        `👤 Ism: <b>${s.name}</b>\n` +
        `🏫 Sinf: <b>${s.className}</b>\n` +
        `📱 Tel: kiritilmagan`,
        { parse_mode: 'HTML' }
      )
    }
  })

  async function finishParentReg(ctx, userId, phone) {
    const parentState = oquvchiModule.state.get(userId)
    const { studentId, studentName } = parentState
    db.registerParent(userId, ctx.from.first_name || '', phone, ctx.from.username || '', studentId)
    db.updateStudentParent(studentId, userId, ctx.from.username || '', phone)
    oquvchiModule.state.delete(userId)
    await ctx.reply(
      `🎉 <b>Ro\'yxatdan o\'tish muvaffaqiyatli!</b>\n\n` +
      `👦 O\'quvchi: <b>${studentName}</b>\n` +
      `📱 Raqam: <b>${phone}</b>\n\n` +
      `Farzandingiz darsga kelmasa, darhol xabardor bo\'lasiz.`,
      { parse_mode: 'HTML', ...Markup.removeKeyboard() }
    )
  }

  bot.launch()
  console.log('✅ Maktab bot ishga tushdi!')

  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

main()
