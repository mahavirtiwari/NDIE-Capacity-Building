using System.Text.RegularExpressions;

namespace Ntms.Application.Common;

/// <summary>
/// Server side twin of the portal's format registry. The browser validates for
/// convenience; these are the rules that actually decide what reaches the
/// database, so the two must stay in step.
/// </summary>
public static partial class Formats
{
    public const string EmailPattern = @"^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$";
    public const string MobilePattern = @"^[6-9][0-9]{9}$";
    public const string PanPattern = @"^[A-Z]{5}[0-9]{4}[A-Z]$";
    public const string TanPattern = @"^[A-Z]{4}[0-9]{5}[A-Z]$";
    public const string GstinPattern = @"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$";
    public const string AadhaarPattern = @"^[2-9][0-9]{11}$";
    public const string PincodePattern = @"^[1-9][0-9]{5}$";
    public const string IfscPattern = @"^[A-Z]{4}0[A-Z0-9]{6}$";
    public const string UdyamPattern = @"^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$";
    public const string BankAccountPattern = @"^[0-9]{9,18}$";
    public const string CodePattern = @"^[A-Z0-9][A-Z0-9/-]{1,19}$";

    [GeneratedRegex(EmailPattern)] private static partial Regex EmailRegex();
    [GeneratedRegex(MobilePattern)] private static partial Regex MobileRegex();
    [GeneratedRegex(PanPattern)] private static partial Regex PanRegex();
    [GeneratedRegex(TanPattern)] private static partial Regex TanRegex();
    [GeneratedRegex(GstinPattern)] private static partial Regex GstinRegex();
    [GeneratedRegex(AadhaarPattern)] private static partial Regex AadhaarRegex();
    [GeneratedRegex(PincodePattern)] private static partial Regex PincodeRegex();
    [GeneratedRegex(IfscPattern)] private static partial Regex IfscRegex();
    [GeneratedRegex(CodePattern)] private static partial Regex CodeRegex();

    public static bool IsEmail(string? value) => Matches(EmailRegex(), value);
    public static bool IsMobile(string? value) => Matches(MobileRegex(), value);
    public static bool IsPan(string? value) => Matches(PanRegex(), value);
    public static bool IsTan(string? value) => Matches(TanRegex(), value);
    public static bool IsGstin(string? value) => Matches(GstinRegex(), value);
    public static bool IsAadhaar(string? value) => Matches(AadhaarRegex(), value);
    public static bool IsPincode(string? value) => Matches(PincodeRegex(), value);
    public static bool IsIfsc(string? value) => Matches(IfscRegex(), value);
    public static bool IsCode(string? value) => Matches(CodeRegex(), value);

    /// <summary>Empty passes, so this composes with a separate required check.</summary>
    private static bool Matches(Regex regex, string? value) =>
        string.IsNullOrWhiteSpace(value) || regex.IsMatch(value.Trim());

    /// <summary>Canonical casing for the documents that are always upper case.</summary>
    public static string? Normalise(string? value) =>
        string.IsNullOrWhiteSpace(value) ? value : value.Trim().ToUpperInvariant();
}
