const sequelize = require('../config/db');
const User = require('./User');
const EducationLevel = require('./EducationLevel');
const Grade = require('./Grade');
const AcademicPeriod = require('./AcademicPeriod');
const Section = require('./Section');
const Student = require('./Student');
const Teacher = require('./Teacher');
const Enrollment = require('./Enrollment');
const Course = require('./Course');
const TeachingAssignment = require('./TeachingAssignment');
const GradeRecord = require('./GradeRecord');
const AttendanceRecord = require('./AttendanceRecord');

User.hasOne(Student, { foreignKey: 'userId', as: 'student' });
Student.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasOne(Teacher, { foreignKey: 'userId', as: 'teacher' });
Teacher.belongsTo(User, { foreignKey: 'userId', as: 'user' });

EducationLevel.hasMany(Grade, { foreignKey: 'educationLevelId', as: 'grades' });
Grade.belongsTo(EducationLevel, { foreignKey: 'educationLevelId', as: 'educationLevel' });

Grade.hasMany(Section, { foreignKey: 'gradeId', as: 'sections' });
Section.belongsTo(Grade, { foreignKey: 'gradeId', as: 'grade' });

AcademicPeriod.hasMany(Section, { foreignKey: 'academicPeriodId', as: 'sections' });
Section.belongsTo(AcademicPeriod, { foreignKey: 'academicPeriodId', as: 'academicPeriod' });

Student.hasMany(Enrollment, { foreignKey: 'studentId', as: 'enrollments' });
Enrollment.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

Section.hasMany(Enrollment, { foreignKey: 'sectionId', as: 'enrollments' });
Enrollment.belongsTo(Section, { foreignKey: 'sectionId', as: 'section' });

AcademicPeriod.hasMany(Enrollment, { foreignKey: 'academicPeriodId', as: 'enrollments' });
Enrollment.belongsTo(AcademicPeriod, { foreignKey: 'academicPeriodId', as: 'academicPeriod' });

Course.hasMany(TeachingAssignment, { foreignKey: 'courseId', as: 'teachingAssignments' });
TeachingAssignment.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

Section.hasMany(TeachingAssignment, { foreignKey: 'sectionId', as: 'teachingAssignments' });
TeachingAssignment.belongsTo(Section, { foreignKey: 'sectionId', as: 'section' });

Teacher.hasMany(TeachingAssignment, { foreignKey: 'teacherId', as: 'teachingAssignments' });
TeachingAssignment.belongsTo(Teacher, { foreignKey: 'teacherId', as: 'teacher' });

TeachingAssignment.hasMany(GradeRecord, { foreignKey: 'teachingAssignmentId', as: 'gradeRecords' });
GradeRecord.belongsTo(TeachingAssignment, { foreignKey: 'teachingAssignmentId', as: 'teachingAssignment' });

Enrollment.hasMany(GradeRecord, { foreignKey: 'enrollmentId', as: 'gradeRecords' });
GradeRecord.belongsTo(Enrollment, { foreignKey: 'enrollmentId', as: 'enrollment' });

TeachingAssignment.hasMany(AttendanceRecord, { foreignKey: 'teachingAssignmentId', as: 'attendanceRecords' });
AttendanceRecord.belongsTo(TeachingAssignment, { foreignKey: 'teachingAssignmentId', as: 'teachingAssignment' });

Enrollment.hasMany(AttendanceRecord, { foreignKey: 'enrollmentId', as: 'attendanceRecords' });
AttendanceRecord.belongsTo(Enrollment, { foreignKey: 'enrollmentId', as: 'enrollment' });

module.exports = {
  sequelize,
  User,
  EducationLevel,
  Grade,
  AcademicPeriod,
  Section,
  Student,
  Teacher,
  Enrollment,
  Course,
  TeachingAssignment,
  GradeRecord,
  AttendanceRecord,
};
