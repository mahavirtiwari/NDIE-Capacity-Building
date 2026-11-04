namespace Ntms.Infrastructure.Email;

/// <summary>
/// Everything is stored in UTC, but a message read in an office in Delhi should
/// say the Indian time. A timestamp in an email cannot be re-rendered by the
/// reader's device the way a portal page can, so it is converted here, once,
/// and labelled so nobody has to guess which zone it refers to.
/// </summary>
public static class IndianTime
{
    /* Windows and Linux disagree on the id, so try both rather than assume
       the deployment target. */
    private static readonly TimeZoneInfo Zone = Resolve();

    private static TimeZoneInfo Resolve()
    {
        foreach (var id in new[] { "India Standard Time", "Asia/Kolkata" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }

        /* IST has no daylight saving and has not changed since 1947, so a fixed
           offset is a safe last resort on a stripped-down container. */
        return TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromMinutes(330), "IST", "IST");
    }

    /// <summary>Converts a UTC instant to IST.</summary>
    public static DateTime From(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(
            utc.Kind == DateTimeKind.Utc ? utc : DateTime.SpecifyKind(utc, DateTimeKind.Utc),
            Zone);

    /// <summary>
    /// The other direction: a wall clock somebody typed in India, as the UTC
    /// instant it names.
    ///
    /// A datetime-local field posts "2026-11-03T11:40" with no zone, and the
    /// person who typed it meant twenty to twelve in the morning here. Stored
    /// as it arrives it is neither UTC nor labelled, and everything
    /// downstream - the serialiser that stamps a Z on the way out, the
    /// comparisons against UtcNow, Format above - reads it as UTC and is five
    /// and a half hours out.
    /// </summary>
    public static DateTime ToUtc(DateTime wallClockInIndia) =>
        TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(wallClockInIndia, DateTimeKind.Unspecified), Zone);

    /// <summary>
    /// What day it is here.
    ///
    /// Every calendar question in this system - has the batch started, is
    /// the fee in force yet, has the empanelment lapsed, which day did
    /// somebody enrol on - is a question about the day in India, and the
    /// server runs on UTC. Asked as DateOnly.FromDateTime(DateTime.UtcNow)
    /// it is yesterday's answer from half past six in the evening until
    /// midnight: a batch that started today reads as starting tomorrow, a
    /// fee effective today does not apply until half past five in the
    /// morning, and an enrolment taken at nine at night is filed under the
    /// day before.
    ///
    /// Seventeen places asked UTC. They ask here.
    /// </summary>
    public static DateOnly Today => DateOnly.FromDateTime(From(DateTime.UtcNow));

    /// <summary>Reader-facing form, e.g. "23 Sep 2026, 05:03 PM IST".</summary>
    public static string Format(DateTime utc) =>
        From(utc).ToString("dd MMM yyyy, hh:mm tt",
            System.Globalization.CultureInfo.InvariantCulture) + " IST";
}
