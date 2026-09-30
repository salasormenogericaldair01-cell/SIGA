const express = require('express');
const healthRoutes = require('./health.routes');
const createAuthRouter = require('./auth.routes');
const userRoutes = require('./user.routes');
const academicRouter = require('./academic.routes');
const peopleEnrollmentRouter = require('./people-enrollment.routes');

function createRouter() {
  const router = express.Router();

  router.use(healthRoutes);
  router.use('/auth', createAuthRouter());
  router.use('/users', userRoutes);
  router.use('/education-levels', academicRouter('educationLevel'));
  router.use('/grades', academicRouter('grade'));
  router.use('/academic-periods', academicRouter('academicPeriod'));
  router.use('/sections', academicRouter('section'));
  router.use('/students', peopleEnrollmentRouter('student'));
  router.use('/teachers', peopleEnrollmentRouter('teacher'));
  router.use('/enrollments', peopleEnrollmentRouter('enrollment'));

  return router;
}

module.exports = createRouter;
