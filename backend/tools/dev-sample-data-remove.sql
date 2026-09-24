/*
  Removes everything dev-sample-data.sql wrote, and nothing else.

      sqlcmd -S "localhost\SQLEXPRESS" -d NtmsDb -i tools\dev-sample-data-remove.sql

  The match is on the SMP prefixes the sample script stamps onto applicant
  codes, application numbers and programme ids. Real records never carry them,
  so this cannot reach genuine data.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* Certificates reference participants and programmes with Restrict, so they
   come out first or the deletes below fail on the foreign keys. */
DELETE c FROM Certificates c
  JOIN Programmes p ON p.Id = c.ProgrammeId WHERE p.ProgrammeId LIKE 'SMP/%';
DELETE pp FROM ProgrammeParticipants pp
  JOIN Programmes p ON p.Id = pp.ProgrammeId WHERE p.ProgrammeId LIKE 'SMP/%';
DELETE FROM Applications WHERE ApplicationNo LIKE 'SMPAPP%';
DELETE FROM Programmes WHERE ProgrammeId LIKE 'SMP/%';
DELETE FROM Applicants WHERE ApplicantCode LIKE 'SMP%';

SELECT 'applicants left' AS item, COUNT(*) AS remaining FROM Applicants WHERE ApplicantCode LIKE 'SMP%'
UNION ALL SELECT 'applications left', COUNT(*) FROM Applications WHERE ApplicationNo LIKE 'SMPAPP%'
UNION ALL SELECT 'programmes left', COUNT(*) FROM Programmes WHERE ProgrammeId LIKE 'SMP/%';
