using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ntms.Api.Serialization;

/// <summary>
/// Timestamps are stored in UTC, but SQL Server hands them back with
/// <see cref="DateTimeKind.Unspecified"/>. Serialised as-is they carry no zone,
/// so a browser in India reads 11:15 UTC as 11:15 IST — five and a half hours
/// adrift. Stamping the zone lets every client render the instant in its own
/// local time, which for this system means IST.
/// </summary>
internal static class UtcJson
{
    /// <summary>Round-trip form, always with the trailing Z.</summary>
    private const string Iso = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'";

    internal static void WriteUtc(Utf8JsonWriter writer, DateTime value)
    {
        var utc = value.Kind switch
        {
            DateTimeKind.Local => value.ToUniversalTime(),
            /* Unspecified means "came back from the database", which this
               system only ever writes in UTC. */
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        };
        writer.WriteStringValue(utc.ToString(Iso, CultureInfo.InvariantCulture));
    }
}

/// <summary>
/// Reads incoming date-times as round-trippable instants and writes them back
/// with an explicit UTC marker. See <see cref="UtcJson"/> for why.
/// </summary>
public class UtcDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(
        ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
        UtcJson.WriteUtc(writer, value);
}

/// <summary>
/// Browsers submit an untouched <c>&lt;input type="date"&gt;</c> as an empty
/// string, not as null. System.Text.Json treats <c>""</c> as a malformed date
/// and fails the whole request body — which surfaces as the misleading
/// "the dto field is required", because binding never completed.
///
/// An optional date left blank means "not set", so empty and whitespace are
/// read as null here rather than rejected. Anything else still has to be a
/// real date, so genuine typos are not swallowed.
/// </summary>
public class NullableDateOnlyConverter : JsonConverter<DateOnly?>
{
    public override DateOnly? Read(
        ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return null;

        if (reader.TokenType == JsonTokenType.String)
        {
            var raw = reader.GetString();
            if (string.IsNullOrWhiteSpace(raw)) return null;
            return DateOnly.Parse(raw, System.Globalization.CultureInfo.InvariantCulture);
        }

        throw new JsonException($"Expected a date string, found {reader.TokenType}.");
    }

    public override void Write(Utf8JsonWriter writer, DateOnly? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else writer.WriteStringValue(value.Value.ToString("yyyy-MM-dd"));
    }
}

/// <inheritdoc cref="NullableDateOnlyConverter"/>
public class NullableDateTimeConverter : JsonConverter<DateTime?>
{
    public override DateTime? Read(
        ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return null;

        if (reader.TokenType == JsonTokenType.String)
        {
            var raw = reader.GetString();
            if (string.IsNullOrWhiteSpace(raw)) return null;
            return DateTime.Parse(raw, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind);
        }

        throw new JsonException($"Expected a date-time string, found {reader.TokenType}.");
    }

    public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else UtcJson.WriteUtc(writer, value.Value);
    }
}

/// <inheritdoc cref="NullableDateOnlyConverter"/>
public class NullableTimeOnlyConverter : JsonConverter<TimeOnly?>
{
    public override TimeOnly? Read(
        ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return null;

        if (reader.TokenType == JsonTokenType.String)
        {
            var raw = reader.GetString();
            if (string.IsNullOrWhiteSpace(raw)) return null;
            return TimeOnly.Parse(raw, System.Globalization.CultureInfo.InvariantCulture);
        }

        throw new JsonException($"Expected a time string, found {reader.TokenType}.");
    }

    public override void Write(Utf8JsonWriter writer, TimeOnly? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else writer.WriteStringValue(value.Value.ToString("HH:mm"));
    }
}
