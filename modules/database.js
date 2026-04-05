const initSqlJs = require('sql.js')
const fs = require('fs')

const DB_PATH = './maktab.db'
let db

async function init() {
  const SQL = await initSqlJs()
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`CREATE TABLE IF NOT EXISTS students (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT NOT NULL,
    class_name    TEXT,
    parent_phone  TEXT,
    parent_tg_id  INTEGER,
    parent_username TEXT
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS parents (
    tg_id       INTEGER PRIMARY KEY,
    full_name   TEXT,
    phone       TEXT,
    username    TEXT,
    student_id  INTEGER
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER,
    message     TEXT,
    sent_tg     INTEGER DEFAULT 0,
    sent_sms    INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  save()
}

function save() {
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

function run(sql, params = []) {
  db.run(sql, params)
  save()
}

function get(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return row
  }
  stmt.free()
  return null
}

function all(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function addStudent(fullName, className, parentPhone = null) {
  db.run(
    'INSERT INTO students (full_name, class_name, parent_phone) VALUES (?, ?, ?)',
    [fullName, className, parentPhone]
  )
  save()
  const row = get('SELECT last_insert_rowid() as id')
  return row.id
}

function getAllStudents() {
  return all('SELECT * FROM students ORDER BY class_name, full_name')
}

function searchStudents(query) {
  return all(
    'SELECT * FROM students WHERE full_name LIKE ? OR class_name LIKE ?',
    [`%${query}%`, `%${query}%`]
  )
}

function getStudentById(id) {
  return get('SELECT * FROM students WHERE id = ?', [id])
}

function updateStudentParent(studentId, tgId, username, phone) {
  run(
    'UPDATE students SET parent_tg_id=?, parent_username=?, parent_phone=? WHERE id=?',
    [tgId, username, phone, studentId]
  )
}

function deleteStudent(id) {
  run('DELETE FROM students WHERE id = ?', [id])
}

function registerParent(tgId, fullName, phone, username, studentId) {
  const existing = get('SELECT * FROM parents WHERE tg_id = ?', [tgId])
  if (existing) {
    run(
      'UPDATE parents SET full_name=?, phone=?, username=?, student_id=? WHERE tg_id=?',
      [fullName, phone, username, studentId, tgId]
    )
  } else {
    run(
      'INSERT INTO parents (tg_id, full_name, phone, username, student_id) VALUES (?, ?, ?, ?, ?)',
      [tgId, fullName, phone, username, studentId]
    )
  }
}

function getParentByTgId(tgId) {
  return get('SELECT * FROM parents WHERE tg_id = ?', [tgId])
}

function logNotification(studentId, message, sentTg, sentSms) {
  run(
    'INSERT INTO notifications (student_id, message, sent_tg, sent_sms) VALUES (?, ?, ?, ?)',
    [studentId, message, sentTg ? 1 : 0, sentSms ? 1 : 0]
  )
}

module.exports = {
  init,
  addStudent,
  getAllStudents,
  searchStudents,
  getStudentById,
  updateStudentParent,
  deleteStudent,
  registerParent,
  getParentByTgId,
  logNotification,
       }
