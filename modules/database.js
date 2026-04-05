const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('maktab.db')

db.serialize(() => {
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
})

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve(this)
    })
  })
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

async function addStudent(fullName, className, parentPhone = null) {
  const res = await run(
    'INSERT INTO students (full_name, class_name, parent_phone) VALUES (?, ?, ?)',
    [fullName, className, parentPhone]
  )
  return res.lastID
}

async function getAllStudents() {
  return await all('SELECT * FROM students ORDER BY class_name, full_name')
}

async function searchStudents(query) {
  return await all(
    'SELECT * FROM students WHERE full_name LIKE ? OR class_name LIKE ?',
    [`%${query}%`, `%${query}%`]
  )
}

async function getStudentById(id) {
  return await get('SELECT * FROM students WHERE id = ?', [id])
}

async function updateStudentParent(studentId, tgId, username, phone) {
  await run(
    'UPDATE students SET parent_tg_id=?, parent_username=?, parent_phone=? WHERE id=?',
    [tgId, username, phone, studentId]
  )
}

async function deleteStudent(id) {
  await run('DELETE FROM students WHERE id = ?', [id])
}

async function registerParent(tgId, fullName, phone, username, studentId) {
  await run(`
    INSERT INTO parents (tg_id, full_name, phone, username, student_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(tg_id) DO UPDATE SET
      full_name=excluded.full_name,
      phone=excluded.phone,
      username=excluded.username,
      student_id=excluded.student_id
  `, [tgId, fullName, phone, username, studentId])
}

async function getParentByTgId(tgId) {
  return await get('SELECT * FROM parents WHERE tg_id = ?', [tgId])
}

async function logNotification(studentId, message, sentTg, sentSms) {
  await run(
    'INSERT INTO notifications (student_id, message, sent_tg, sent_sms) VALUES (?, ?, ?, ?)',
    [studentId, message, sentTg ? 1 : 0, sentSms ? 1 : 0]
  )
}

module.exports = {
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
