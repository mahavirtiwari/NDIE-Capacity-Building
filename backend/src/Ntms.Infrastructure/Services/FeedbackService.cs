using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// The feedback a programme type asks for once a batch is over, and what
/// comes back.
///
/// Anonymous, and structurally so. A submission writes two rows that are
/// never joined: the answers, which carry the batch and nothing about a
/// person, and a receipt against the participant, which carries no
/// answers. Reporting reads the first and can only count; the app reads
/// the second to know whether to still ask.
/// </summary>
public class FeedbackService(
    NtmsDbContext db,
    INotificationService mail,
    IConfiguration config)
{
    private IQueryable<FeedbackForm> Base => db.FeedbackForms
        .Include(f => f.ProgramType)
        .Include(f => f.Questions.OrderBy(q => q.DisplayOrder)).ThenInclude(q => q.Options)
        .Include(f => f.Questions).ThenInclude(q => q.OptionSet!).ThenInclude(o => o.Items);

    /* ----------------------------------------------------------- office */

    public async Task<PagedResult<FeedbackFormDto>> ListAsync(
        PagedRequest request, int? programTypeId, string? status, CancellationToken ct)
    {
        var query = Base.AsNoTracking()
            .WhereIf(programTypeId.HasValue, f => f.ProgramTypeId == programTypeId)
            .WhereIf(!string.IsNullOrWhiteSpace(status), f => f.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                f => f.ProgramType!.Name.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(FeedbackForm))!, f => f.Id);

        var page = await query.ToPagedResultAsync(request, Map, ct);
        await FillCountsAsync(page.Items, ct);
        return page;
    }

    public async Task<FeedbackFormDto> GetAsync(int id, CancellationToken ct)
    {
        var dto = Map(await Base.AsNoTracking().FirstOrDefaultAsync(f => f.Id == id, ct)
                      ?? throw AppException.NotFound("Feedback form"));
        await FillCountsAsync([dto], ct);
        return dto;
    }

    private async Task FillCountsAsync(IReadOnlyList<FeedbackFormDto> rows, CancellationToken ct)
    {
        if (rows.Count == 0) return;

        var ids = rows.Select(r => r.ProgramTypeId).ToList();
        var counts = await db.FeedbackResponses.AsNoTracking()
            .Where(r => ids.Contains(r.ProgramTypeId))
            .GroupBy(r => r.ProgramTypeId)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);

        foreach (var row in rows) row.ResponseCount = counts.GetValueOrDefault(row.ProgramTypeId);
    }

    public async Task<FeedbackFormDto> CreateAsync(FeedbackFormUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);

        if (!await db.ProgramTypes.AnyAsync(p => p.Id == dto.ProgramTypeId, ct))
            throw AppException.NotFound("Program type");

        if (await db.FeedbackForms.AnyAsync(
                f => f.ProgramTypeId == dto.ProgramTypeId && f.Status == RecordStatus.Active, ct))
        {
            throw AppException.Conflict(
                "This program type already has a feedback form. Edit that one, or switch it "
                + "off before adding another.");
        }

        var entity = new FeedbackForm
        {
            ProgramTypeId = dto.ProgramTypeId,
            Title = dto.Title.Trim(),
            Intro = Blank(dto.Intro),
            Status = EnumMaps.ToStatus(dto.Status),
        };

        Build(entity, dto.Questions);
        db.FeedbackForms.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<FeedbackFormDto> UpdateAsync(
        int id, FeedbackFormUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.FeedbackForms
            .Include(f => f.Questions).ThenInclude(q => q.Options)
            .FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("Feedback form");

        Validate(dto);

        entity.Title = dto.Title.Trim();
        entity.Intro = Blank(dto.Intro);
        entity.Status = EnumMaps.ToStatus(dto.Status);

        db.FeedbackQuestions.RemoveRange(entity.Questions);
        entity.Questions.Clear();
        Build(entity, dto.Questions);

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<FeedbackFormDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.FeedbackForms.FirstOrDefaultAsync(f => f.Id == id, ct)
                     ?? throw AppException.NotFound("Feedback form");

        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var entity = await db.FeedbackForms.FirstOrDefaultAsync(f => f.Id == id, ct)
                     ?? throw AppException.NotFound("Feedback form");

        var answered = await db.FeedbackResponses
            .CountAsync(r => r.ProgramTypeId == entity.ProgramTypeId, ct);

        if (answered > 0)
        {
            throw AppException.Conflict(
                $"{answered} people have answered this form. Switch it off instead - deleting "
                + "it would leave their answers with no questions to read them against.");
        }

        db.FeedbackForms.Remove(entity);
        await db.SaveChangesAsync(ct);
    }

    /* -------------------------------------------------------- reporting */

    /// <summary>
    /// What the answers add up to. Counts, averages and the comments on
    /// their own: there is no applicant on a response to report by.
    /// </summary>
    public async Task<FeedbackSummaryDto> SummaryAsync(
        int programTypeId, int? programmeId, CancellationToken ct)
    {
        var form = await Base.AsNoTracking()
            .Where(f => f.ProgramTypeId == programTypeId)
            .OrderByDescending(f => f.Status == RecordStatus.Active).ThenByDescending(f => f.Id)
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Feedback form");

        var responses = await db.FeedbackResponses.AsNoTracking()
            .Where(r => r.ProgramTypeId == programTypeId)
            .WhereIf(programmeId.HasValue, r => r.ProgrammeId == programmeId)
            .Select(r => r.Answers)
            .ToListAsync(ct);

        var parsed = new List<Dictionary<string, JsonElement>>();
        foreach (var body in responses)
        {
            try
            {
                var one = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(body);
                if (one is not null) parsed.Add(one);
            }
            catch (JsonException)
            {
                /* One unreadable set must not cost the whole report. */
            }
        }

        var summary = new FeedbackSummaryDto
        {
            ProgramTypeId = programTypeId,
            ProgramTypeName = form.ProgramType?.Name,
            ResponseCount = parsed.Count,
        };

        foreach (var question in form.Questions.OrderBy(q => q.DisplayOrder))
        {
            var row = new FeedbackQuestionSummaryDto
            {
                Key = question.Key,
                Text = question.Text,
                Type = question.Type.ToString(),
            };

            var given = parsed
                .Where(p => p.TryGetValue(question.Key, out var v)
                            && v.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined))
                .Select(p => p[question.Key])
                .ToList();

            row.Answered = given.Count;

            switch (question.Type)
            {
                case FeedbackQuestionType.Rating:
                    var scores = given
                        .Select(v => v.ValueKind == JsonValueKind.Number
                            ? v.GetDecimal()
                            : decimal.TryParse(v.ToString(), out var d) ? d : (decimal?)null)
                        .Where(d => d.HasValue)
                        .Select(d => d!.Value)
                        .ToList();

                    if (scores.Count > 0)
                        row.Average = Math.Round(scores.Average(), 2);
                    break;

                case FeedbackQuestionType.Text:
                    /* Shuffled, so the order cannot be lined up against the
                       order people submitted in - which would be a way back
                       to who said what. */
                    row.Comments =
                    [
                        .. given.Select(v => v.ToString())
                            .Where(t => !string.IsNullOrWhiteSpace(t))
                            .OrderBy(_ => RandomNumberGenerator.GetInt32(int.MaxValue)),
                    ];
                    break;

                default:
                    var labels = Choices(question).ToDictionary(o => o.Value, o => o.Label);
                    row.Tally =
                    [
                        .. given.Select(v => v.ToString())
                            .Where(t => !string.IsNullOrWhiteSpace(t))
                            .GroupBy(t => t)
                            .Select(g => new FeedbackTallyDto
                            {
                                Value = g.Key,
                                Label = labels.GetValueOrDefault(g.Key, g.Key),
                                Count = g.Count(),
                            })
                            .OrderByDescending(t => t.Count),
                    ];
                    break;
            }

            summary.Questions.Add(row);
        }

        return summary;
    }

    /* -------------------------------------------------------- applicant */

    /// <summary>
    /// The batches this applicant sat that are over and have a form to
    /// fill in, with whether they have done it.
    /// </summary>
    public async Task<List<FeedbackInvitationDto>> MineAsync(int applicantId, CancellationToken ct)
    {
        var sat = await db.ProgrammeParticipants.AsNoTracking()
            .Where(p => p.ApplicantId == applicantId
                        && p.Programme!.Status == ProgramStatus.Conducted)
            .Select(p => new
            {
                ParticipantId = p.Id,
                p.ProgrammeId,
                p.Programme!.ProgrammeName,
                Code = p.Programme!.ProgrammeId,
                p.Programme!.ProgramTypeId,
                ProgramTypeName = p.Programme!.ProgramType!.Name,
                p.Programme!.EndDate,
            })
            .ToListAsync(ct);

        if (sat.Count == 0) return [];

        var withForm = await db.FeedbackForms.AsNoTracking()
            .Where(f => f.Status == RecordStatus.Active)
            .Select(f => f.ProgramTypeId)
            .ToListAsync(ct);

        var ids = sat.Select(s => s.ParticipantId).ToList();
        var done = await db.FeedbackReceipts.AsNoTracking()
            .Where(r => ids.Contains(r.ParticipantId))
            .ToDictionaryAsync(r => r.ParticipantId, r => r.SubmittedOn, ct);

        return
        [
            .. sat.Where(s => withForm.Contains(s.ProgramTypeId))
                .Select(s => new FeedbackInvitationDto
                {
                    ParticipantId = s.ParticipantId,
                    ProgrammeId = s.ProgrammeId,
                    ProgrammeName = s.ProgrammeName,
                    ProgrammeCode = s.Code,
                    ProgramTypeName = s.ProgramTypeName,
                    EndedOn = s.EndDate,
                    Given = done.ContainsKey(s.ParticipantId),
                    GivenOn = done.GetValueOrDefault(s.ParticipantId) is var on && on == default
                        ? null
                        : on,
                })
                .OrderBy(s => s.Given).ThenByDescending(s => s.EndedOn),
        ];
    }

    /// <summary>The form behind one of those batches.</summary>
    public async Task<FeedbackFormDto> FormForAsync(
        int applicantId, int participantId, CancellationToken ct)
    {
        var participation = await Participation(applicantId, participantId, ct);

        var form = await Base.AsNoTracking()
            .FirstOrDefaultAsync(f => f.ProgramTypeId == participation.ProgramTypeId
                                      && f.Status == RecordStatus.Active, ct)
            ?? throw AppException.NotFound("Feedback form for this program");

        return Map(form);
    }

    /// <summary>
    /// Records the answers, and separately that this person has answered.
    ///
    /// Both in one save, so neither can exist without the other, and with
    /// nothing written that connects them.
    /// </summary>
    public async Task SubmitAsync(
        int applicantId, int participantId, Dictionary<string, object?> answers,
        CancellationToken ct)
    {
        var participation = await Participation(applicantId, participantId, ct);
        await RecordAsync(participantId, participation, answers, ct);
    }

    /// <summary>
    /// The write itself, shared by the app and the link in the e-mail.
    ///
    /// Whichever door the answers came through, the same two rows are
    /// written in the same save: the answers, carrying the batch and
    /// nothing about a person, and the receipt, carrying the person and
    /// nothing about the answers.
    /// </summary>
    private async Task RecordAsync(
        int participantId, (int ProgrammeId, int ProgramTypeId) participation,
        Dictionary<string, object?> answers, CancellationToken ct)
    {
        if (await db.FeedbackReceipts.AnyAsync(r => r.ParticipantId == participantId, ct))
            throw new AppException("You have already given feedback for this program.");

        var form = await Base.AsNoTracking()
            .FirstOrDefaultAsync(f => f.ProgramTypeId == participation.ProgramTypeId
                                      && f.Status == RecordStatus.Active, ct)
            ?? throw AppException.NotFound("Feedback form for this program");

        var kept = new Dictionary<string, object?>();
        var missing = new List<string>();

        foreach (var question in form.Questions)
        {
            answers.TryGetValue(question.Key, out var value);
            var empty = value is null || string.IsNullOrWhiteSpace(value.ToString());

            if (empty)
            {
                if (question.Required) missing.Add(question.Text);
                continue;
            }

            kept[question.Key] = value;
        }

        if (missing.Count > 0)
        {
            throw new AppException(
                $"Please answer: {string.Join(", ", missing.Take(3))}"
                + (missing.Count > 3 ? $" and {missing.Count - 3} more." : "."));
        }

        db.FeedbackResponses.Add(new FeedbackResponse
        {
            ProgrammeId = participation.ProgrammeId,
            ProgramTypeId = participation.ProgramTypeId,
            FeedbackFormId = form.Id,
            Answers = JsonSerializer.Serialize(kept),
            /* The day only. The receipt below carries the moment, and two
               exact timestamps written together would match up. */
            SubmittedOn = DateOnly.FromDateTime(DateTime.UtcNow),
        });

        db.FeedbackReceipts.Add(new FeedbackReceipt
        {
            ParticipantId = participantId,
            SubmittedOn = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(ct);
    }

    /* ------------------------------------------------------- invitations */

    /// <summary>
    /// Asks everybody who sat a batch for their feedback, by e-mail.
    ///
    /// Sent when the report passes quality control, which is the moment
    /// the batch is conducted and the course is, for the participant,
    /// over. Waiting for them to open the app again would mean never
    /// hearing from most of them.
    ///
    /// Nothing is sent where the programme type has no form switched on:
    /// a link to an empty page is worse than no link. Nothing is sent
    /// twice either — somebody who has already answered, or who already
    /// holds a live link, is left alone.
    ///
    /// Returns how many went out.
    /// </summary>
    public async Task<int> InviteAsync(int programmeId, CancellationToken ct)
    {
        var programme = await db.Programmes.AsNoTracking()
            .Include(p => p.ProgramType)
            .FirstOrDefaultAsync(p => p.Id == programmeId, ct);

        if (programme is null) return 0;

        var form = await db.FeedbackForms.AsNoTracking().FirstOrDefaultAsync(
            f => f.ProgramTypeId == programme.ProgramTypeId
                 && f.Status == RecordStatus.Active, ct);

        if (form is null) return 0;

        var root = PublicBaseUrl();
        if (string.IsNullOrWhiteSpace(root)) return 0;

        /* Everybody on the batch who has an address to write to.

           The register the coordinator keeps at the door is a different
           table, and the receipt that stops a second answer hangs off
           this one — so somebody who was only ever written into that
           register has nothing to hang a receipt on and cannot be asked.
           Registering at the door now enrols the applicant here too,
           which is how a walk-in comes to be asked at all. */
        var people = await db.ProgrammeParticipants.AsNoTracking()
            .Where(p => p.ProgrammeId == programmeId)
            .Select(p => new
            {
                p.Id,
                Name = p.Applicant!.FullName,
                p.Applicant!.Email,
            })
            .ToListAsync(ct);

        if (people.Count == 0) return 0;

        var ids = people.Select(p => p.Id).ToList();

        var answered = await db.FeedbackReceipts.AsNoTracking()
            .Where(r => ids.Contains(r.ParticipantId))
            .Select(r => r.ParticipantId)
            .ToListAsync(ct);

        var holding = await db.FeedbackInvites.AsNoTracking()
            .Where(i => ids.Contains(i.ParticipantId) && i.ExpiresOn > DateTime.UtcNow)
            .Select(i => i.ParticipantId)
            .ToListAsync(ct);

        var sending = new List<(string Email, string Name, string Token)>();

        foreach (var person in people)
        {
            if (string.IsNullOrWhiteSpace(person.Email)) continue;
            if (answered.Contains(person.Id) || holding.Contains(person.Id)) continue;

            /* An expired row is replaced rather than added to, because
               one invitation per person is what the table allows — and
               the old link should stop working when a new one is sent. */
            var stale = await db.FeedbackInvites
                .FirstOrDefaultAsync(i => i.ParticipantId == person.Id, ct);

            if (stale is not null) db.FeedbackInvites.Remove(stale);

            var token = NewToken();

            db.FeedbackInvites.Add(new FeedbackInvite
            {
                ParticipantId = person.Id,
                TokenHash = Hash(token),
                SentOn = DateTime.UtcNow,
                ExpiresOn = DateTime.UtcNow.AddDays(60),
            });

            sending.Add((person.Email, person.Name, token));
        }

        if (sending.Count == 0) return 0;

        /* Saved before anything is sent. A link sitting in somebody's
           inbox that the database has never heard of is the one failure
           here that cannot be put right afterwards. */
        await db.SaveChangesAsync(ct);

        foreach (var (email, name, token) in sending)
        {
            await mail.SendFeedbackRequestAsync(
                programme, email, name, Link(root, token), ct);
        }

        return sending.Count;
    }

    /// <summary>What the page behind one of those links shows.</summary>
    public async Task<FeedbackLinkDto> ByTokenAsync(string token, CancellationToken ct)
    {
        var (invite, context) = await ResolveAsync(token, ct);

        var given = await db.FeedbackReceipts
            .AnyAsync(r => r.ParticipantId == invite.ParticipantId, ct);

        var form = await Base.AsNoTracking().FirstOrDefaultAsync(
            f => f.ProgramTypeId == context.ProgramTypeId
                 && f.Status == RecordStatus.Active, ct);

        return new FeedbackLinkDto
        {
            ProgrammeName = context.ProgrammeName,
            ProgrammeCode = context.ProgrammeCode,
            ProgramTypeName = context.ProgramTypeName,
            EndedOn = context.EndDate,
            Given = given,
            Form = given || form is null ? null : Map(form),
        };
    }

    /// <summary>The answers, given through the link rather than the app.</summary>
    public async Task SubmitByTokenAsync(
        string token, Dictionary<string, object?> answers, CancellationToken ct)
    {
        var (invite, context) = await ResolveAsync(token, ct);
        await RecordAsync(
            invite.ParticipantId, (context.ProgrammeId, context.ProgramTypeId), answers, ct);
    }

    /// <summary>
    /// The participant a link stands for.
    ///
    /// One refusal for every way of being wrong — unknown, expired, or
    /// pointing at a place on a batch that no longer exists. The page is
    /// open to anybody who has the address, and telling them which of
    /// those it was would turn it into a way of testing guesses.
    /// </summary>
    private async Task<(FeedbackInvite Invite, ProgrammeFacts Context)> ResolveAsync(
        string token, CancellationToken ct)
    {
        var hash = Hash((token ?? string.Empty).Trim());

        var invite = await db.FeedbackInvites.AsNoTracking()
            .FirstOrDefaultAsync(i => i.TokenHash == hash, ct);

        if (invite is null || invite.ExpiresOn <= DateTime.UtcNow)
            throw new AppException("That feedback link is not valid or has expired.", 410);

        var context = await db.ProgrammeParticipants.AsNoTracking()
            .Where(p => p.Id == invite.ParticipantId)
            .Select(p => new ProgrammeFacts(
                p.ProgrammeId,
                p.Programme!.ProgramTypeId,
                p.Programme!.ProgrammeName,
                p.Programme!.ProgrammeId,
                p.Programme!.ProgramType!.Name,
                p.Programme!.EndDate))
            .FirstOrDefaultAsync(ct)
            ?? throw new AppException("That feedback link is not valid or has expired.", 410);

        return (invite, context);
    }

    private record ProgrammeFacts(
        int ProgrammeId,
        int ProgramTypeId,
        string ProgrammeName,
        string ProgrammeCode,
        string ProgramTypeName,
        DateOnly EndDate);

    private static string Link(string root, string token) =>
        $"{root.TrimEnd('/')}/feedback/{token}";

    /// <summary>
    /// A token nobody can guess: 32 bytes of randomness, URL-safe, and
    /// written down nowhere but the e-mail it goes in.
    /// </summary>
    private static string NewToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');

    private static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    /// <summary>
    /// Where the portal answers, for building the link. Site:PublicUrl,
    /// failing that the origin the deployment already allows — as the
    /// certificate e-mail does it. With neither, nothing is sent: a link
    /// to the wrong host is worse than no e-mail at all.
    /// </summary>
    private string PublicBaseUrl()
    {
        var configured = config["Site:PublicUrl"];
        if (!string.IsNullOrWhiteSpace(configured)) return configured;

        return config.GetSection("Cors:AllowedOrigins").Get<string[]>()?.FirstOrDefault()
            ?? string.Empty;
    }

    /* ------------------------------------------------------------ helpers */

    private async Task<(int ProgrammeId, int ProgramTypeId)> Participation(
        int applicantId, int participantId, CancellationToken ct)
    {
        var row = await db.ProgrammeParticipants.AsNoTracking()
            .Where(p => p.Id == participantId && p.ApplicantId == applicantId)
            .Select(p => new
            {
                p.ProgrammeId,
                p.Programme!.ProgramTypeId,
                p.Programme!.Status,
            })
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Your place on that program");

        if (row.Status != ProgramStatus.Conducted)
        {
            throw new AppException(
                "Feedback opens once the program has been conducted.");
        }

        return (row.ProgrammeId, row.ProgramTypeId);
    }

    private static IEnumerable<FieldOptionDto> Choices(FeedbackQuestion q) =>
        q.OptionSetId is null
            ? q.Options.OrderBy(o => o.DisplayOrder)
                .Select(o => new FieldOptionDto { Value = o.Value, Label = o.Label })
            : (q.OptionSet?.Items ?? [])
                .Where(i => i.Status == RecordStatus.Active)
                .OrderBy(i => i.DisplayOrder).ThenBy(i => i.Id)
                .Select(i => new FieldOptionDto
                {
                    Value = i.Value,
                    Label = i.Label,
                    Description = i.Description,
                });

    private static void Build(FeedbackForm entity, List<FeedbackQuestionDto> questions)
    {
        var order = 0;
        foreach (var dto in questions.Where(q => !string.IsNullOrWhiteSpace(q.Text)))
        {
            order++;
            var type = EnumMaps.ParseEnum(dto.Type, FeedbackQuestionType.Rating);

            var question = new FeedbackQuestion
            {
                Key = string.IsNullOrWhiteSpace(dto.Key) ? Slug(dto.Text) : Normalise(dto.Key),
                Text = dto.Text.Trim(),
                HelpText = Blank(dto.HelpText),
                Type = type,
                Required = dto.Required,
                DisplayOrder = order,
                MaxRating = Math.Clamp(dto.MaxRating <= 0 ? 5 : dto.MaxRating, 2, 10),
                OptionSetId = dto.OptionSetId is > 0 ? dto.OptionSetId : null,
            };

            /* Only a question that offers choices, and only where it holds
               its own: a shared list is read, never copied. */
            if (question.OptionSetId is null
                && type is FeedbackQuestionType.Select or FeedbackQuestionType.Radio)
            {
                var optionOrder = 0;
                foreach (var option in dto.Options.Where(o => !string.IsNullOrWhiteSpace(o.Label)))
                {
                    optionOrder++;
                    question.Options.Add(new FeedbackQuestionOption
                    {
                        Value = string.IsNullOrWhiteSpace(option.Value)
                            ? Slug(option.Label)
                            : option.Value.Trim(),
                        Label = option.Label.Trim(),
                        DisplayOrder = optionOrder,
                    });
                }
            }

            entity.Questions.Add(question);
        }
    }

    private static void Validate(FeedbackFormUpsertDto dto)
    {
        var live = dto.Questions.Where(q => !string.IsNullOrWhiteSpace(q.Text)).ToList();

        Guard.Check()
            .Required(dto.Title, "Title")
            .When(dto.ProgramTypeId <= 0, "Choose a program type.")
            .When(live.Count == 0, "A feedback form needs at least one question.")
            .ThrowIfInvalid();

        var needsChoices = live.Where(q =>
            EnumMaps.ParseEnum(q.Type, FeedbackQuestionType.Rating)
                is FeedbackQuestionType.Select or FeedbackQuestionType.Radio);

        foreach (var question in needsChoices)
        {
            if (question.OptionSetId is > 0) continue;
            if (question.Options.Any(o => !string.IsNullOrWhiteSpace(o.Label))) continue;

            throw new AppException(
                $"'{question.Text.Trim()}' asks somebody to choose, so it needs some choices "
                + "- its own, or a shared list.");
        }

        var keys = live
            .Select(q => string.IsNullOrWhiteSpace(q.Key) ? Slug(q.Text) : Normalise(q.Key))
            .ToList();

        if (keys.Distinct().Count() != keys.Count)
        {
            throw new AppException(
                "Two questions would be stored against the same key. Give them different "
                + "wording, or set the key by hand.");
        }
    }

    private static string Normalise(string key) =>
        new(key.Trim().Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());

    private static string Slug(string text) =>
        new(text.Trim().ToLowerInvariant().Replace(' ', '_')
            .Where(c => char.IsLetterOrDigit(c) || c == '_').Take(60).ToArray());

    private static string? Blank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static FeedbackFormDto Map(FeedbackForm f) => new()
    {
        Id = f.Id,
        ProgramTypeId = f.ProgramTypeId,
        ProgramTypeName = f.ProgramType?.Name,
        ProgramTypeCode = f.ProgramType?.Code,
        Title = f.Title,
        Intro = f.Intro,
        Status = f.Status.ToApi(),
        Questions =
        [
            .. f.Questions.OrderBy(q => q.DisplayOrder).Select(q => new FeedbackQuestionDto
            {
                Id = q.Id,
                Key = q.Key,
                Text = q.Text,
                HelpText = q.HelpText,
                Type = q.Type.ToString(),
                Required = q.Required,
                DisplayOrder = q.DisplayOrder,
                MaxRating = q.MaxRating,
                OptionSetId = q.OptionSetId,
                OptionSetName = q.OptionSet?.Name,
                Options = [.. Choices(q)],
            }),
        ],
    };
}
