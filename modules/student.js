const { isAdmin } = require('./roles')
const db = require('./database')

const state = new Map()

function register(bot) {
  bot.command('addstudent', ctx => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('Ruxsat yoq.')
    state.set(ctx.from.id, { step: 'name' })
    ctx.reply('Oquvchi ismini kiriting:')
  })

  bot.command('students', ctx => {
    if (!isAdmin(ctx.from.id)) return
    const students = db.getAllStudents()
    if (!students.length) return ctx.reply('Royxat bosh.')
    ctx.reply(students.map(s => s.full_name + ' - ' + (s.class_name || '?')).join('\n'))
  })

  bot.command('deletestudent', ctx => {
    if (!isAdmin(ctx.from.id)) return
    const id = parseInt(ctx.message.text.split(' ')[1])
    if (!id) return ctx.reply('Ishlatish: /deletestudent 1')
    db.deleteStudent(id)
    ctx.reply('Ochirildi.')
  })
}

module.exports = { register, state }
