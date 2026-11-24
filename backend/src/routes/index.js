const express = require('express');

const healthRoutes = require('../modules/health/health.routes');
const createAuthRouter = require('../modules/auth/auth.routes');
const usersRoutes = require('../modules/users/users.routes');

const educationLevelsRoutes = require('../modules/education-levels/education-levels.routes');
const gradesRoutes = require('../modules/grades/grades.routes');
const academicPeriodsRoutes = require('../modules/academic-periods/academic-periods.routes');
const sectionsRoutes = require('../modules/sections/sections.routes');

const studentsRoutes = require('../modules/students/students.routes');
const teachersRoutes = require('../modules/teachers/teachers.routes');
const enrollmentsRoutes = require('../modules/enrollments/enrollments.routes');

const coursesRoutes = require('../modules/courses/courses.routes');
const teachingAssignmentsRoutes = require('../modules/teaching-assignments/teaching-assignments.routes');
const gradeRecordsRoutes = require('../modules/grade-records/grade-records.routes');
const attendanceRecordsRoutes = require('../modules/attendance-records/attendance-records.routes');

function createRouter() {
  const router = express.Router();

  router.use(healthRoutes);
  router.use('/auth', createAuthRouter());
  router.use('/users', usersRoutes);

  router.use('/education-levels', educationLevelsRoutes);
  router.use('/grades', gradesRoutes);
  router.use('/academic-periods', academicPeriodsRoutes);
  router.use('/sections', sectionsRoutes);

  router.use('/students', studentsRoutes);
  router.use('/teachers', teachersRoutes);
  router.use('/enrollments', enrollmentsRoutes);

  router.use('/courses', coursesRoutes);
  router.use('/teaching-assignments', teachingAssignmentsRoutes);
  router.use('/grade-records', gradeRecordsRoutes);
  router.use('/attendance-records', attendanceRecordsRoutes);

  return router;
}

module.exports = createRouter;
