/*
 * Makes and removes the throwaway applicant accounts a load run signs in
 * with.
 *
 * A console tool rather than a few lines of PowerShell because of the
 * password. The application hashes with ASP.NET Core Identity's v3
 * format and checks sign-in with the same, so anything that writes an
 * account has to produce exactly that - and a hand-rolled version of it
 * gets a thousand accounts that exist and cannot be used, with the first
 * sign of trouble being a load run where every sign-in fails. That is
 * not a hypothetical: it is what the first attempt at this did.
 *
 * So it uses the hasher itself. Same package, same defaults, same
 * answer.
 */
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;

var mode = args.Length > 0 ? args[0].ToLowerInvariant() : "help";

if (mode is not ("make" or "remove"))
{
    Console.WriteLine("""
        usage:
          accounts make   <count> <csv path>
          accounts remove <csv path>

        The connection string comes from LOADTEST_CONNECTION and the
        password from LOADTEST_PASSWORD, because a command line can be
        read by anything on the machine that can list processes.

        Called by accounts.ps1, which does the guarding and the prompting.
        """);
    return 2;
}

var connectionString = Environment.GetEnvironmentVariable("LOADTEST_CONNECTION");

if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine("LOADTEST_CONNECTION is not set. Run accounts.ps1 rather than this.");
    return 2;
}

await using var db = new SqlConnection(connectionString);
await db.OpenAsync();

if (mode == "remove")
{
    var csv = args[1];

    /* The children first: an applicant with rows pointing at it will not
       delete, and a half-removed test account is worse than none. */
    var command = db.CreateCommand();
    command.CommandTimeout = 600;
    command.CommandText = """
        DECLARE @ids TABLE (Id int PRIMARY KEY);
        INSERT INTO @ids SELECT Id FROM Applicants WHERE ApplicantCode LIKE 'LOADTEST%';

        DELETE FROM ProfileAttachments    WHERE ApplicantId IN (SELECT Id FROM @ids);
        DELETE FROM ProfileScrutinyEvents WHERE SubmissionId IN
            (SELECT Id FROM ProfileSubmissions WHERE ApplicantId IN (SELECT Id FROM @ids));
        DELETE FROM ProfileSubmissions    WHERE ApplicantId IN (SELECT Id FROM @ids);
        DELETE FROM ProgrammeParticipants WHERE ApplicantId IN (SELECT Id FROM @ids);
        DELETE FROM ApplicantAnswers      WHERE ApplicantId IN (SELECT Id FROM @ids);
        DELETE FROM Applicants            WHERE Id IN (SELECT Id FROM @ids);

        SELECT COUNT(*) FROM @ids;
        """;

    var gone = (int?) await command.ExecuteScalarAsync() ?? 0;
    Console.WriteLine($"Removed {gone} load-test applicant(s).");

    if (File.Exists(csv))
    {
        File.Delete(csv);
        Console.WriteLine($"Removed {csv}.");
    }

    return 0;
}

var count = int.Parse(args[1]);
var outFile = args[2];
var password = Environment.GetEnvironmentVariable("LOADTEST_PASSWORD");

if (string.IsNullOrWhiteSpace(password))
{
    Console.Error.WriteLine("LOADTEST_PASSWORD is not set. Run accounts.ps1 rather than this.");
    return 2;
}

/* One hash for all of them. These are throwaway logins that share a
   password anyway, and a salt per account would be protecting nothing
   that is not already written in the CSV beside them. A thousand hashes
   at a hundred thousand iterations each is several minutes of waiting
   for that. */
var hash = new PasswordHasher<object>().HashPassword(new object(), password);

Console.WriteLine($"Writing {count} account(s) ...");

var rows = new List<string>
{
    "# Throwaway load-test accounts. Staging only.",
    "# Made by accounts.ps1; remove them with: .\\accounts.ps1 -Remove",
    "# This file holds passwords. It is git-ignored. Do not commit it.",
};

for (var i = 1; i <= count; i++)
{
    var code = $"LOADTEST{i:D6}";

    var insert = db.CreateCommand();
    insert.CommandText = """
        IF NOT EXISTS (SELECT 1 FROM Applicants WHERE ApplicantCode = @code)
        INSERT INTO Applicants
            (ApplicantCode, FullName, Email, Mobile, Pan, PasswordHash,
             EmailVerified, MobileVerified, KycStatus, RegisteredOn, IsBlocked,
             Gender, SocialCategory, CreatedOn)
        VALUES
            (@code, @name, @email, @mobile, @pan, @hash,
             1, 1, 'Pending', SYSUTCDATETIME(), 0,
             'Male', 'General', SYSUTCDATETIME());
        """;

    insert.Parameters.AddWithValue("@code", code);
    insert.Parameters.AddWithValue("@name", $"Load Test {i}");
    insert.Parameters.AddWithValue("@email", $"load{i}@loadtest.invalid");
    insert.Parameters.AddWithValue("@mobile", $"9{i:D9}");
    insert.Parameters.AddWithValue("@pan", $"LOAD{i:D5}A");
    insert.Parameters.AddWithValue("@hash", hash);

    await insert.ExecuteNonQueryAsync();

    rows.Add($"{code},{password}");

    if (i % 200 == 0) Console.WriteLine($"  {i} ...");
}

await File.WriteAllLinesAsync(outFile, rows);

Console.WriteLine($"{count} account(s) written to {outFile}.");
return 0;
