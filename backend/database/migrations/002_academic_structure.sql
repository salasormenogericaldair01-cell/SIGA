CREATE TYPE "EducationLevelCode" AS ENUM ('INICIAL', 'PRIMARIA', 'SECUNDARIA');

CREATE TABLE "EducationLevel" (
  "id" UUID NOT NULL,
  "code" "EducationLevelCode" NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EducationLevel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EducationLevel_code_key" ON "EducationLevel"("code");

CREATE TABLE "Grade" (
  "id" UUID NOT NULL,
  "educationLevelId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Grade_educationLevelId_order_key" ON "Grade"("educationLevelId", "order");
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AcademicPeriod" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicPeriod_dates_check" CHECK ("startDate" < "endDate")
);
CREATE UNIQUE INDEX "AcademicPeriod_name_key" ON "AcademicPeriod"("name");

CREATE TABLE "Section" (
  "id" UUID NOT NULL,
  "gradeId" UUID NOT NULL,
  "academicPeriodId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Section_gradeId_academicPeriodId_name_key" ON "Section"("gradeId", "academicPeriodId", "name");
ALTER TABLE "Section" ADD CONSTRAINT "Section_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Section" ADD CONSTRAINT "Section_academicPeriodId_fkey" FOREIGN KEY ("academicPeriodId") REFERENCES "AcademicPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
