cat > modules/student.js << 'EOF'
const { Markup } = require('telegraf')
const db = require('./database')
const { isAdmin } = require('./roles')

const state = new Map()

function register(bot) {
  bot.command('addstudent', ctx => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('⛔ Ruxsat yo\'q.')
    state.set(ctx.from.id, { step: 'name' })
    ctx.reply('👤 O\'quvchining to\'liq ismini kiriting:')
  })

  bot.command('students', ctx => {
    if (!isAdmin(ctx.from.id)) return
    const students = db.getAllStudents()
    if (!students.length) return ctx.reply('Royxat bosh.')
    const lines = ['Oquvchilar:\n']
    students.forEach(s => {
      lines.push(`${s.full_name} - ${s.class_name || '?'} | ${s.parent_phone || 'tel yoq'}`)
    })
    ctx.reply(lines.join('\n'))
  })

  bot.command('deletestudent', ctx => {
    if (!isAdmin(ctx.from.id)) return
    const id = parseInt(ctx.message.text.split(' ')[1])
    if (!id) return ctx.reply('Ishlatish: /deletestudent <id>')
    db.deleteStudent(id)
    ctx.reply('Ochirildi.')
  })
}

module.exports = { register, state }
EOF
