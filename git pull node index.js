const { Markup } = require('telegraf')
const db = require('./database')
const { isAdmin } = require('./roles')

const state = new Map()

function register(bot) {
  bot.command('addstudent', ctx => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('⛔ Ruxsat yo\'q.')
    state.set(ctx.from.id, { step: 'name' })
    ctx.reply('👤 O\'quvchining <b>to\'liq ismini</b> kiriting:', { parse_mode: 'HTML' })
  })

  bot.command('students', async ctx => {
    if (!isAdmin(ctx.from.id)) return
    const students = db.getAllStudents()
    if (!students.length) return ctx.reply('📭 Ro\'yxat bo\'sh. /addstudent orqali qo\'shing.')
    const lines = ['📋 <b>O\'quvchilar ro\'yxati:</b>\n']
    students.forEach(s => {
      const tg = s.parent_username
        ? `@${s.parent_username}`
        : s.parent_tg_id ? '✅ ulangan' : '❌ ulanmagan'
      lines.push(`<b>${s.full_name}</b> — ${s.class_name || '?'}\n   📱 ${s.parent_phone || '—'} | TG: ${tg}\n`)
    })
    ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
  })

  bot.command('deletestudent', ctx => {
    if (!isAdmin(ctx.from.id)) return
    const args = ctx.message.text.split(' ')
    const id = parseInt(args[1])
    if (!id) return ctx.reply('Ishlatish: /deletestudent <id>')
    const student = db.getStudentById(id)
    if (!student) return ctx.reply('❌ O\'quvchi topilmadi.')
    db.deleteStudent(id)
    ctx.reply(`✅ <b>${student.full_name}</b> o\'chirildi.`, { parse_mode: 'HTML' })
  })
}

module.exports = { register, state }
