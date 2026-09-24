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

    /// <summary>Reader-facing form, e.g. "23 Sep 2026, 05:03 PM IST".</summary>
    public static string Format(DateTime utc) =>
        From(utc).ToString("dd MMM yyyy, hh:mm tt",
            System.Globalization.CultureInfo.InvariantCulture) + " IST";
}
