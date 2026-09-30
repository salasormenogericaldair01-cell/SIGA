CREATE TYPE "GradeValue" AS ENUM ('AD', 'A', 'B', 'C');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED');

CREATE UNIQUE INDEX "Enrollment_id_sectionId_key" ON "Enrollment"("id", "sectionId");

CREATE TABLE "Course" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

CREATE TABLE "TeachingAssignment" (
  "id" UUID NOT NULL,
  "courseId" UUID NOT NULL,
  "sectionId" UUID NOT NULL,
  "teacherId" UUID NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeachingAssignment_courseId_sectionId_key" ON "TeachingAssignment"("courseId", "sectionId");
CREATE UNIQUE INDEX "TeachingAssignment_id_sectionId_key" ON "TeachingAssignment"("id", "sectionId");
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GradeRecord" (
  "id" UUID NOT NULL,
  "teachingAssignmentId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "sectionId" UUID NOT NULL,
  "term" INTEGER NOT NULL,
  "value" "GradeValue" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GradeRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GradeRecord_term_check" CHECK ("term" BETWEEN 1 AND 4)
);
CREATE UNIQUE INDEX "GradeRecord_teachingAssignmentId_enrollmentId_term_key"
  ON "GradeRecord"("teachingAssignmentId", "enrollmentId", "term");
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_teachingAssignmentId_sectionId_fkey"
  FOREIGN KEY ("teachingAssignmentId", "sectionId") REFERENCES "TeachingAssignment"("id", "sectionId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_enrollmentId_sectionId_fkey"
  FOREIGN KEY ("enrollmentId", "sectionId") REFERENCES "Enrollment"("id", "sectionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "AttendanceRecord" (
  "id" UUID NOT NULL,
  "teachingAssignmentId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "sectionId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceRecord_teachingAssignmentId_enrollmentId_date_key"
  ON "AttendanceRecord"("teachingAssignmentId", "enrollmentId", "date");
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_teachingAssignmentId_sectionId_fkey"
  FOREIGN KEY ("teachingAssignmentId", "sectionId") REFERENCES "TeachingAssignment"("id", "sectionId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_enrollmentId_sectionId_fkey"
  FOREIGN KEY ("enrollmentId", "sectionId") REFERENCES "Enrollment"("id", "sectionId") ON DELETE RESTRICT ON UPDATE RESTRICT;
