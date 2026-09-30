const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const verifyTarget = require('./verify-demo-target');

const prisma = new PrismaClient();
const order = ['attendanceRecord', 'gradeRecord', 'enrollment', 'teachingAssignment', 'course', 'section', 'academicPeriod', 'grade', 'educationLevel', 'teacher', 'student', 'user'];
const file = path.resolve(__dirname, '../.env.demo-siga_test-manifest.json');
const demoEmails = new Set(['admin', 'secretaria', 'docente-a', 'docente-b', 'estudiante-a', 'estudiante-b'].map((name) => `demo-${name}@siga.invalid`));
const teacherEmails = new Set(['demo-docente-a@siga.invalid', 'demo-docente-b@siga.invalid']);
const studentCodes = new Set(['DEMO-EST-A', 'DEMO-EST-B']);
const courseCodes = new Set(['DEMO-MAT', 'DEMO-COM']);
const sectionNames = new Set(['DEMO-A', 'DEMO-B']);
const includes = {
  teacher: { user: true },
  grade: { educationLevel: true },
  section: { academicPeriod: true },
  teachingAssignment: { course: true, section: true, teacher: { include: { user: true } } },
  enrollment: { student: true, section: true },
  gradeRecord: { teachingAssignment: { include: { course: true } }, enrollment: { include: { student: true } } },
  attendanceRecord: { teachingAssignment: { include: { course: true } }, enrollment: { include: { student: true } } },
};

function belongsToDemo(kind, row) {
  switch (kind) {
    case 'user': return demoEmails.has(row.email);
    case 'student': return studentCodes.has(row.studentCode);
    case 'teacher': return teacherEmails.has(row.user.email);
    case 'educationLevel': return ['PRIMARIA', 'SECUNDARIA'].includes(row.code) && row.name.startsWith('DEMO ');
    case 'grade': return row.order === 1 && row.name.startsWith('DEMO ') && ['PRIMARIA', 'SECUNDARIA'].includes(row.educationLevel.code);
    case 'academicPeriod': return /^DEMO \d{4}$/.test(row.name);
    case 'section': return sectionNames.has(row.name) && /^DEMO \d{4}$/.test(row.academicPeriod.name);
    case 'course': return courseCodes.has(row.code);
    case 'teachingAssignment': return courseCodes.has(row.course.code) && sectionNames.has(row.section.name) && teacherEmails.has(row.teacher.user.email);
    case 'enrollment': return studentCodes.has(row.student.studentCode) && sectionNames.has(row.section.name);
    case 'gradeRecord':
    case 'attendanceRecord': return courseCodes.has(row.teachingAssignment.course.code) && studentCodes.has(row.enrollment.student.studentCode);
    default: return false;
  }
}

async function main() {
  if (process.env.DEMO_TARGET !== 'siga_test') throw new Error('La limpieza DEMO solo admite siga_test');
  await verifyTarget(prisma, 'siga_test');
  if (!fs.existsSync(file)) throw new Error('No existe el manifiesto de registros DEMO creados en siga_test');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const kind of order) {
    if (!Array.isArray(manifest[kind]) || manifest[kind].some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
      throw new Error('Manifiesto DEMO inválido');
    }
  }
  await prisma.$transaction(async (tx) => {
    for (const kind of order) {
      const ids = manifest[kind];
      if (!ids.length) continue;
      const rows = await tx[kind].findMany({ where: { id: { in: ids } }, ...(includes[kind] ? { include: includes[kind] } : {}) });
      if (new Set(ids).size !== ids.length || rows.length !== ids.length || rows.some((row) => !belongsToDemo(kind, row))) {
        throw new Error('El manifiesto contiene IDs ajenos o inexistentes; no se eliminó ningún registro');
      }
    }
    for (const kind of order) {
      if (manifest[kind].length) {
        const result = await tx[kind].deleteMany({ where: { id: { in: manifest[kind] } } });
        if (result.count !== manifest[kind].length) throw new Error('La limpieza no coincidió con el manifiesto');
      }
    }
  });
  fs.unlinkSync(file);
  console.log('Registros DEMO creados por el seed eliminados de siga_test mediante sus IDs; ningún otro registro fue seleccionado.');
}

main().catch((error) => {
  console.error(`No se pudo limpiar la demo de pruebas: ${error.code || error.message}`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
