using Ntms.Application.Common;
using Ntms.Domain.Common;

namespace Ntms.Infrastructure.Mapping;

/// <summary>
/// Translates between the enum values stored in the database and the display
/// strings the clients exchange. A few enums read as prose on screen
/// ("Government Body", "Training Programme"), so the mapping is explicit rather
/// than a plain <c>ToString()</c>.
/// </summary>
public static class EnumMaps
{
    /* ------------------------------------------------------- simple enums */

    public static string ToApi(this RecordStatus value) => value.ToString();
    public static string ToApi(this DeliveryMode value) => value.ToString();
    public static string ToApi(this BaseRole value) => value.ToString();
    public static string ToApi(this FeeComponentKind value) => value.ToString();
    public static string ToApi(this QuestionType value) => value.ToString();
    public static string ToApi(this DifficultyLevel value) => value.ToString();
    public static string ToApi(this MaterialKind value) => value.ToString();
    public static string ToApi(this KycStatus value) => value.ToString();
    public static string ToApi(this ApplicationStatus value) => value.ToString();
    public static string ToApi(this PaymentStatus value) => value.ToString();
    public static string ToApi(this ScrutinyAction value) => value.ToString();
    public static string ToApi(this ProgramMode value) => value.ToString();
    public static string ToApi(this ProgramStatus value) => value.ToString();
    public static string ToApi(this ParticipantResult value) => value.ToString();

    /* ----------------------------------------------------- prose mappings */

    public static string ToApi(this AgencyType value) => value switch
    {
        AgencyType.GovernmentBody => "Government Body",
        AgencyType.IndustryAssociation => "Industry Association",
        AgencyType.AcademicInstitute => "Academic Institute",
        AgencyType.PrivatePartner => "Private Partner",
        _ => value.ToString(),
    };

    /// <summary>Field types travel in lower case, matching the form builder.</summary>
    public static string ToApi(this FieldType value) => value switch
    {
        FieldType.TextArea => "textarea",
        FieldType.MultiSelect => "multiselect",
        _ => value.ToString().ToLowerInvariant(),
    };

    /* ----------------------------------------------------------- parsing */

    /// <summary>
    /// Parses a client supplied string, ignoring case, spaces and dashes. Throws
    /// an <see cref="AppException"/> so the API answers 400 rather than 500.
    /// </summary>
    public static T ParseEnum<T>(string? value, T fallback) where T : struct, Enum
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;

        var cleaned = value.Replace(" ", string.Empty).Replace("-", string.Empty).Replace("_", string.Empty);
        if (Enum.TryParse<T>(cleaned, ignoreCase: true, out var parsed)) return parsed;

        throw new AppException($"'{value}' is not a valid {typeof(T).Name}.");
    }

    /// <summary>Same as <see cref="ParseEnum{T}"/> but returns null on blank input.</summary>
    public static T? ParseEnumOrNull<T>(string? value) where T : struct, Enum
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var cleaned = value.Replace(" ", string.Empty).Replace("-", string.Empty).Replace("_", string.Empty);
        return Enum.TryParse<T>(cleaned, ignoreCase: true, out var parsed) ? parsed : null;
    }

    /// <summary>
    /// A self-declared field: blank means the question was not answered, which
    /// stays null rather than becoming the first option.
    ///
    /// Unlike <see cref="ParseEnumOrNull{T}"/> a value that was supplied but is
    /// not recognised throws, because filing a typo as "not stated" would lose
    /// an answer the applicant did give.
    /// </summary>
    public static T? ParseDeclared<T>(string? value) where T : struct, Enum =>
        string.IsNullOrWhiteSpace(value) ? null : ParseEnum(value, default(T));

    public static RecordStatus ToStatus(string? value) => ParseEnum(value, RecordStatus.Active);

    /* -------------------------------------------- comma separated helpers */

    public static List<string> SplitList(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? []
            : [.. value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)];

    public static List<int> SplitInts(string? value) =>
        [.. SplitList(value).Select(x => int.TryParse(x, out var n) ? n : 0).Where(n => n > 0)];

    public static string JoinList(IEnumerable<string>? values) =>
        values is null ? string.Empty : string.Join(',', values.Where(v => !string.IsNullOrWhiteSpace(v)));

    public static string JoinInts(IEnumerable<int>? values) =>
        values is null ? string.Empty : string.Join(',', values.Distinct().Order());
}
