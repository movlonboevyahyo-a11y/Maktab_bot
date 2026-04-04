const Database = require('better-sqlite3')
const db = new Database('maktab.db')

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT NOT NULL,
    class_name    TEXT,
    parent_phone  TEXT,
    parent_tg_id  INTEGER,
    parent_username TEXT
  );

  CREATE TABLE IF NOT EXISTS parents (
    tg_id       INTEGER PRIMARY KEY,
    full_name   TEXT,
    phone       TEXT,
    username    TEXT,
    student_id  INTEGER
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER,
    message     TEXT,
    sent_tg     INTEGER DEFAULT 0,
    sent_sms    INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

function addStudent(fullName, className, parentPhone = null) {
  const stmt = db.prepare(
    'INSERT INTO students (full_name, class_name, parent_phone) VALUES (?, ?, ?)'
  )
  const info = stmt.run(fullName, className, parentPhone)
  return info.lastInsertRowid
}

function getAllStudents() {
  return db.prepare('SELECT * FROM students ORDER BY class_name, full_name').all()
}

function searchStudents(query) {
  return db.prepare(
    'SELECT * FROM students WHERE full_name LIKE ? OR class_name LIKE ?'
  ).all(`%${query}%`, `%${query}%`)
}

function getStudentById(id) {
  return db.prepare('SELECT * FROM students WHERE id = ?').get(id)
}

function updateStudentParent(studentId, tgId, username, phone) {
  db.prepare(
    'UPDATE students SET parent_tg_id=?, parent_username=?, parent_phone=? WHERE id=?'
  ).run(tgId, username, phone, studentId)
}

function deleteStudent(id) {
  db.prepare('DELETE FROM students WHERE id = ?').run(id)
}

function registerParent(tgId, fullName, phone, username, studentId) {
  db.prepare(`
    INSERT INTO parents (tg_id, full_name, phone, username, student_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(tg_id) DO UPDATE SET
      full_name=excluded.full_name,
      phone=excluded.phone,
      username=excluded.username,
      student_id=excluded.student_id
  `).run(tgId, fullName, phone, username, studentId)
}

function getParentByTgId(tgId) {
  return db.prepare('SELECT * FROM parents WHERE tg_id = ?').get(tgId)
}

function logNotification(studentId, message, sentTg, sentSms) {
  db.prepare(
    'INSERT INTO notifications (student_id, message, sent_tg, sent_sms) VALUES (?, ?, ?, ?)'
  ).run(studentId, message, sentTg ? 1 : 0, sentSms ? 1 : 0)
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
