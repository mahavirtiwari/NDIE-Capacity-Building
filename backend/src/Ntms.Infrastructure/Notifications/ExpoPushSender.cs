using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace Ntms.Infrastructure.Notifications;

/// <summary>One message on its way to one handset.</summary>
public record PushMessage(string Token, string Title, string Body, string? LinkPath);

/// <summary>How a batch went: what was accepted, and what to stop sending to.</summary>
public record PushOutcome(int Delivered, int Failed, string? Note, IReadOnlyList<string> DeadTokens);

public interface IPushSender
{
    Task<PushOutcome> SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken ct);
}

/// <summary>
/// Hands the messages to Expo's push service, which passes them to Apple
/// and Google.
///
/// Expo rather than Firebase directly: the apps are built with Expo, the
/// token the handset reports is an Expo one, and the Firebase key for
/// Android is uploaded once into the Expo project rather than carried by
/// this server. Nothing here holds a credential.
///
/// A token the service says is dead — the app was uninstalled, or the
/// handset was wiped — is reported back so it can be retired. Sending to
/// it forever is how a push log fills with failures nobody can act on.
/// </summary>
public class ExpoPushSender(HttpClient http, ILogger<ExpoPushSender> logger) : IPushSender
{
    /// <summary>Expo takes a hundred at a time.</summary>
    private const int Chunk = 100;

    private static readonly JsonSerializerOptions Json = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public async Task<PushOutcome> SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken ct)
    {
        if (messages.Count == 0) return new PushOutcome(0, 0, null, []);

        var delivered = 0;
        var failed = 0;
        string? note = null;
        var dead = new List<string>();

        foreach (var batch in messages.Chunk(Chunk))
        {
            var payload = batch.Select(m => new
            {
                to = m.Token,
                title = m.Title,
                body = m.Body,
                sound = "default",
                data = string.IsNullOrWhiteSpace(m.LinkPath) ? null : new { link = m.LinkPath },
            });

            try
            {
                var response = await http.PostAsJsonAsync(
                    "https://exp.host/--/api/v2/push/send", payload, Json, ct);

                var body = await response.Content.ReadAsStringAsync(ct);
                if (!response.IsSuccessStatusCode)
                {
                    failed += batch.Length;
                    note ??= $"The push service answered {(int)response.StatusCode}.";
                    logger.LogWarning("Expo push refused a batch: {Status} {Body}",
                        (int)response.StatusCode, Trim(body));
                    continue;
                }

                var (ok, bad, firstError, deadHere) = ReadTickets(body, batch);
                delivered += ok;
                failed += bad;
                note ??= firstError;
                dead.AddRange(deadHere);
            }
            catch (Exception caught) when (caught is not OperationCanceledException)
            {
                failed += batch.Length;
                note ??= "The push service could not be reached.";
                logger.LogWarning(caught, "Expo push could not be reached");
            }
        }

        return new PushOutcome(delivered, failed, note, dead);
    }

    /// <summary>
    /// Reads the tickets back, one per message in the order they were sent.
    ///
    /// A ticket is not a delivery — Expo accepts the message and tells the
    /// store later — but it is where a wrong or retired token is named, and
    /// that is the part worth acting on.
    /// </summary>
    private static (int Ok, int Bad, string? Error, List<string> Dead) ReadTickets(
        string body, PushMessage[] batch)
    {
        var ok = 0;
        var bad = 0;
        string? error = null;
        var dead = new List<string>();

        try
        {
            using var parsed = JsonDocument.Parse(body);
            if (!parsed.RootElement.TryGetProperty("data", out var tickets)
                || tickets.ValueKind != JsonValueKind.Array)
            {
                return (batch.Length, 0, null, dead);
            }

            var index = 0;
            foreach (var ticket in tickets.EnumerateArray())
            {
                var status = ticket.TryGetProperty("status", out var s) ? s.GetString() : "ok";
                if (status == "ok")
                {
                    ok++;
                }
                else
                {
                    bad++;
                    error ??= ticket.TryGetProperty("message", out var m)
                        ? m.GetString()
                        : "A message was refused.";

                    var code = ticket.TryGetProperty("details", out var d)
                               && d.TryGetProperty("error", out var e)
                        ? e.GetString()
                        : null;
                    if (code == "DeviceNotRegistered" && index < batch.Length)
                        dead.Add(batch[index].Token);
                }

                index++;
            }
        }
        catch (JsonException)
        {
            return (0, batch.Length, "The push service answered with something unreadable.", dead);
        }

        return (ok, bad, error, dead);
    }

    private static string Trim(string body) => body.Length <= 400 ? body : body[..400];
}
