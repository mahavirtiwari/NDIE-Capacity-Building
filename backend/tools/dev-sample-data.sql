/*
  Sample data for demonstrating the dashboard. Development only.

  Every row this script writes is tagged so it can be removed again exactly:
  applicants are coded SMP#####, programmes SMP/2026/##, and applications
  SMPAPP#####. Nothing else in the database carries those prefixes, so
  dev-sample-data-remove.sql can undo this without touching real records.

  It is safe to run twice: the first statement clears anything a previous run
  left behind.

      sqlcmd -S "localhost\SQLEXPRESS" -d NtmsDb -E -C -i tools\dev-sample-data.sql

  It reuses whichever program types, agency, coordinator and states already
  exist rather than inventing masters, so the figures line up with the filters
  on screen. If there are no program types or no portal users it stops and says
  so instead of writing half a dataset.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
/* Required for any write to a table carrying a filtered index — the
   Certificates table has one, and sqlcmd does not set this by default. */
SET QUOTED_IDENTIFIER ON;

/* ------------------------------------------------------------- teardown */

/* Certificates reference participants and programmes with Restrict, so they
   come out first or the deletes below fail on the foreign keys. */
DELETE c FROM Certificates c
  JOIN Programmes p ON p.Id = c.ProgrammeId WHERE p.ProgrammeId LIKE 'SMP/%';
DELETE pp FROM ProgrammeParticipants pp
  JOIN Programmes p ON p.Id = pp.ProgrammeId WHERE p.ProgrammeId LIKE 'SMP/%';
DELETE FROM Applications WHERE ApplicationNo LIKE 'SMPAPP%';
DELETE FROM Programmes WHERE ProgrammeId LIKE 'SMP/%';
DELETE FROM Applicants WHERE ApplicantCode LIKE 'SMP%';

/* ------------------------------------------------------- what we hang off */

DECLARE @agencyId int = (SELECT MIN(Id) FROM ImplementingAgencies);
DECLARE @coordinatorId int = (SELECT MIN(Id) FROM PortalUsers);

IF @agencyId IS NULL OR @coordinatorId IS NULL
BEGIN
    RAISERROR('Need at least one implementing agency and one portal user first.', 16, 1);
    RETURN;
END;

/* The program types drive category and sub-category, so a dashboard filtered
   by category shows exactly the rows that type belongs to. */
DECLARE @types TABLE (Seq int IDENTITY(0, 1), Id int, CategoryId int, SubCategoryId int);
INSERT INTO @types (Id, CategoryId, SubCategoryId)
SELECT Id, CategoryId, SubCategoryId FROM ProgramTypes ORDER BY Id;

DECLARE @typeCount int = (SELECT COUNT(*) FROM @types);
IF @typeCount = 0
BEGIN
    RAISERROR('Need at least one program type first.', 16, 1);
    RETURN;
END;

/* A dozen states so the map and the coverage table have something to show. */
DECLARE @states TABLE (Seq int IDENTITY(0, 1), Code int);
INSERT INTO @states (Code)
SELECT TOP 12 Code FROM LgdStates
ORDER BY CASE Name
    WHEN 'MAHARASHTRA' THEN 1 WHEN 'UTTAR PRADESH' THEN 2 WHEN 'TAMIL NADU' THEN 3
    WHEN 'GUJARAT' THEN 4 WHEN 'KARNATAKA' THEN 5 WHEN 'WEST BENGAL' THEN 6
    WHEN 'RAJASTHAN' THEN 7 WHEN 'MADHYA PRADESH' THEN 8 WHEN 'BIHAR' THEN 9
    WHEN 'DELHI' THEN 10 WHEN 'KERALA' THEN 11 WHEN 'PUNJAB' THEN 12
    ELSE 99 END, Code;

DECLARE @stateCount int = (SELECT COUNT(*) FROM @states);

/* ----------------------------------------------------------- applicants */

/* The mix is deliberately uneven. An even split would hide a chart that is
   silently drawing equal slices regardless of the data. */
DECLARE @n int = 1;
WHILE @n <= 96
BEGIN
    DECLARE @g varchar(10) =
        CASE WHEN @n % 100 < 3 THEN 'Other'
             WHEN @n % 5 IN (0, 1, 3) THEN 'Male'
             ELSE 'Female' END;
    DECLARE @sc varchar(10) =
        CASE WHEN @n % 10 IN (0, 1, 2, 3) THEN 'General'
             WHEN @n % 10 IN (4, 5, 6) THEN 'OBC'
             WHEN @n % 10 IN (7, 8) THEN 'SC'
             ELSE 'ST' END;
    DECLARE @tSeq int = @n % @typeCount;

    INSERT INTO Applicants
        (ApplicantCode, FullName, Email, Mobile, Pan, CategoryId, SubCategoryId,
         PasswordHash, EmailVerified, MobileVerified, KycStatus, StateCode,
         Gender, SocialCategory, RegisteredOn, IsBlocked, CreatedOn, CreatedBy)
    SELECT
        CONCAT('SMP', RIGHT(CONCAT('00000', @n), 5)),
        CONCAT('Sample Candidate ', @n),
        CONCAT('sample', @n, '@example.invalid'),
        CONCAT('9', RIGHT(CONCAT('000000000', 810000000 + @n * 137), 9)),
        CONCAT('SMPLE', RIGHT(CONCAT('0000', 1000 + @n), 4), 'S'),
        t.CategoryId, t.SubCategoryId,
        /* Not a hash of anything: these accounts must never sign in. */
        'DISABLED-SAMPLE-DATA',
        1, 1, 'Verified',
        (SELECT Code FROM @states WHERE Seq = @n % @stateCount),
        @g, @sc,
        DATEADD(day, -(@n * 3), SYSUTCDATETIME()), 0, SYSUTCDATETIME(), 'sample-data'
    FROM @types t WHERE t.Seq = @tSeq;

    SET @n = @n + 1;
END;

/* ----------------------------------------------------------- programmes */

DECLARE @p int = 1;
WHILE @p <= 12
BEGIN
    DECLARE @pType int = @p % @typeCount;
    DECLARE @start date = DATEFROMPARTS(YEAR(GETDATE()), @p, 8);

    INSERT INTO Programmes
        (ProgrammeId, ProgrammeName, CategoryId, SubCategoryId, ProgramTypeId,
         AgencyId, CoordinatorId, Mode, Venue, City, StateCode, StartDate, EndDate,
         MaxParticipants, ParticipantCount, RegistrationsOpen, Status, CreatedOn, CreatedBy)
    SELECT
        CONCAT('SMP/2026/', RIGHT(CONCAT('0', @p), 2)),
        CONCAT('Sample batch ', @p),
        t.CategoryId, t.SubCategoryId, t.Id,
        @agencyId, @coordinatorId,
        CASE WHEN @p % 4 = 0 THEN 'Virtual' ELSE 'Physical' END,
        CONCAT('Sample training centre ', @p),
        CONCAT('Sample city ', @p),
        (SELECT Code FROM @states WHERE Seq = @p % @stateCount),
        @start, DATEADD(day, 4, @start),
        40, 0, 0,
        /* Most are done, so "Programmes conducted" is not the same number as
           the total — the two KPIs have to be visibly different figures. */
        CASE WHEN @p >= 11 THEN 'CalendarCreated' ELSE 'Conducted' END,
        SYSUTCDATETIME(), 'sample-data'
    FROM @types t WHERE t.Seq = @pType;

    SET @p = @p + 1;
END;

/* ------------------------------------------- applications and attendance */

/* Each applicant applies once, for their own program type, and those on a
   conducted batch in the same state are enrolled onto it. Participants are
   therefore always a subset of approved applications, which is what the KPI
   row claims. */
INSERT INTO Applications
    (ApplicationNo, ApplicantId, ProgramTypeId, CategoryId, SubCategoryId, Status,
     SubmittedOn, PaymentStatus, FeeAmount, TdsPercent, StateCode, Responses,
     CreatedOn, CreatedBy)
SELECT
    CONCAT('SMPAPP', RIGHT(CONCAT('00000', a.Id), 5)),
    a.Id, pt.Id, a.CategoryId, a.SubCategoryId,
    CASE WHEN a.Id % 9 = 0 THEN 'Rejected'
         WHEN a.Id % 7 = 0 THEN 'UnderScrutiny'
         WHEN a.Id % 5 = 0 THEN 'Approved'
         ELSE 'Enrolled' END,
    DATEADD(day, -(a.Id % 200), SYSUTCDATETIME()),
    'Paid', 2500, 0, a.StateCode, '{}',
    SYSUTCDATETIME(), 'sample-data'
FROM Applicants a
JOIN ProgramTypes pt ON pt.SubCategoryId = a.SubCategoryId
WHERE a.ApplicantCode LIKE 'SMP%';

/* Attendance: spread the enrolled applicants over the conducted batches that
   match their program type. */
INSERT INTO ProgrammeParticipants
    (ProgrammeId, ApplicantId, ApplicationId, EnrolledOn, AttendancePercent,
     ExamScore, Result, CreatedOn, CreatedBy)
SELECT
    p.Id, a.Id, app.Id, p.StartDate,
    85 + (a.Id % 15),
    55 + (a.Id % 40),
    CASE WHEN a.Id % 11 = 0 THEN 'Fail' ELSE 'Pass' END,
    SYSUTCDATETIME(), 'sample-data'
FROM Applicants a
JOIN Applications app ON app.ApplicantId = a.Id AND app.Status = 'Enrolled'
CROSS APPLY (
    SELECT TOP 1 p2.Id, p2.StartDate
    FROM Programmes p2
    WHERE p2.ProgrammeId LIKE 'SMP/%'
      AND p2.Status = 'Conducted'
      AND p2.ProgramTypeId = app.ProgramTypeId
    ORDER BY ABS(p2.Id - a.Id) % 7, p2.Id
) p
WHERE a.ApplicantCode LIKE 'SMP%';

/* The stored count has to agree with the rows just written, or the programme
   list and the dashboard would report different attendance for one batch. */
UPDATE p
SET ParticipantCount = (SELECT COUNT(*) FROM ProgrammeParticipants pp WHERE pp.ProgrammeId = p.Id)
FROM Programmes p
WHERE p.ProgrammeId LIKE 'SMP/%';

/* ------------------------------------------------------------- what landed */

SELECT 'applicants' AS item, COUNT(*) AS rows_written FROM Applicants WHERE ApplicantCode LIKE 'SMP%'
UNION ALL SELECT 'applications', COUNT(*) FROM Applications WHERE ApplicationNo LIKE 'SMPAPP%'
UNION ALL SELECT 'programmes', COUNT(*) FROM Programmes WHERE ProgrammeId LIKE 'SMP/%'
UNION ALL SELECT 'participants', COUNT(*) FROM ProgrammeParticipants pp
    JOIN Programmes p ON p.Id = pp.ProgrammeId WHERE p.ProgrammeId LIKE 'SMP/%';
