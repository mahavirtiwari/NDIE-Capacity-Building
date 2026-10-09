using System.Globalization;
using System.Net;
using System.Text;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;

namespace Ntms.Infrastructure.Reporting;

/// <summary>
/// The report of a programme that was actually conducted.
///
/// One self-contained HTML document: what was run, where, by whom, to
/// whom, with the photographs taken on the day embedded in it rather than
/// linked. Self-contained is the whole point — the file is downloaded and
/// mailed on, and a report whose evidence is a set of links into a portal
/// the reader cannot sign into is not a report.
///
/// HTML rather than a generated PDF, the way certificates are done here.
/// A browser prints it to PDF on demand and gets the paper size, margins
/// and fonts of whoever is printing, which is a better answer than
/// guessing at layout in a drawing library — and there is nothing stored,
/// so there is no second copy of the record to keep in step with the
/// first.
///
/// Built from the sealed monitoring record, so the same programme renders
/// the same report every time it is asked for.
/// </summary>
public static class ProgrammeReportRenderer
{
    /// <summary>
    /// How many bytes of photographs to embed before giving up on the
    /// rest.
    ///
    /// Base64 costs a third on top, and a workshop with two hundred
    /// photographs would otherwise produce a document no mail server
    /// will carry and no browser will open. Past this the remaining
    /// photographs are named and counted instead, which is honest about
    /// what is missing rather than silently truncating.
    /// </summary>
    private const long EmbedBudget = 24 * 1024 * 1024;

    public sealed record Rendered(string Html, string FileName);

    /// <summary>Everything the report draws on, read once by the caller.</summary>
    public sealed record Source(
        Programme Programme,
        ProgrammeSubmission Submission,
        ProgrammeVenue? Venue,
        IReadOnlyList<ProgrammeTrainer> Trainers,
        IReadOnlyList<MonitoringSession> Sessions,
        IReadOnlyList<OnSpotParticipant> Participants,
        IReadOnlyList<MonitoringPhoto> Photos,
        string? CoordinatorName,
        Func<MonitoringPhoto, byte[]?> ReadPhoto);

    public static Rendered Render(Source source)
    {
        var budget = EmbedBudget;
        var html = new StringBuilder(64 * 1024);

        Head(html, source);
        Cover(html, source);
        VenueSection(html, source, ref budget);
        Trainers(html, source, ref budget);
        Attendance(html, source, ref budget);
        Sessions(html, source, ref budget);
        Participants(html, source);
        Decision(html, source);
        html.Append("</body></html>");

        var code = string.IsNullOrWhiteSpace(source.Programme.ProgrammeId)
            ? $"programme-{source.Programme.Id}"
            : source.Programme.ProgrammeId;

        return new Rendered(html.ToString(), $"{Safe(code)}-report.html");
    }

    /* ------------------------------------------------------------ parts */

    private static void Head(StringBuilder html, Source s)
    {
        html.Append("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">");
        html.Append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">");
        html.Append("<title>").Append(E(s.Programme.ProgrammeId))
            .Append(" · Programme report</title>");

        /* All of it inline. The document is downloaded and opened from a
           disc, where a stylesheet on the server is a broken link. */
        html.Append("""
            <style>
              :root { --ink: #1f2430; --muted: #5b6475; --rule: #d9dee8; --brand: #9b2c3c; }
              * { box-sizing: border-box; }
              body {
                margin: 0; padding: 28px;
                font: 13px/1.5 "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
                color: var(--ink); background: #fff;
              }
              h1 { font-size: 21px; margin: 0 0 4px; }
              h2 {
                font-size: 15px; margin: 0 0 12px; padding: 7px 10px;
                background: #fdf3f4; border-left: 3px solid var(--brand); color: #6b1a25;
              }
              section { margin: 0 0 26px; page-break-inside: auto; }
              .lede { color: var(--muted); margin: 0 0 2px; }
              /* A page of its own. The height keeps the three blocks
                 apart on screen; the page break puts the sections after
                 it when this is printed. */
              .cover {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                min-height: 86vh;
                padding-bottom: 20px;
                margin-bottom: 28px;
                border-bottom: 2px solid var(--brand);
                page-break-after: always;
              }
              .cover__top { border-bottom: 1px solid var(--rule); padding-bottom: 12px; }
              .cover__org { margin: 0; font-size: 15px; font-weight: 600; color: var(--brand); }
              .cover__sub { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
              .cover__mid { padding: 32px 0; }
              .cover__kicker {
                margin: 0 0 6px; font-size: 11px; font-weight: 600;
                letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
              }
              .cover h1 { font-size: 27px; line-height: 1.25; margin: 0 0 4px; }
              .cover__code {
                margin: 0 0 22px; font-size: 14px; font-weight: 600;
                letter-spacing: 0.04em; color: var(--brand);
              }
              .cover__facts { margin: 0; }
              .cover__facts th { width: 190px; }
              .cover__foot { margin: 0; font-size: 11px; color: var(--muted); }

              /* One column per day of the programme: narrow, centred,
                 and never wrapped onto a second line. */
              td.day, th.day { width: 52px; text-align: center; white-space: nowrap; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
              th, td { border: 1px solid var(--rule); padding: 5px 8px; text-align: left; vertical-align: top; }
              th { background: #f4f6fa; font-weight: 600; }
              td.n, th.n { width: 46px; text-align: center; }
              .entry { margin: 0 0 16px; page-break-inside: avoid; }
              .entry h3 {
                font-size: 13px; margin: 0 0 6px; padding: 4px 8px;
                background: #faeed0; border-left: 3px solid #c9971a; color: #7a5406;
              }
              .shots { display: flex; flex-wrap: wrap; gap: 10px; }
              figure { margin: 0; width: 230px; page-break-inside: avoid; }
              figure img {
                width: 100%; height: 170px; object-fit: cover;
                border: 1px solid var(--rule); border-radius: 3px; background: #eef1f6;
              }
              figcaption { font-size: 11px; color: var(--muted); padding-top: 3px; }
              .muted { color: var(--muted); }
              .none { color: var(--muted); font-style: italic; }
              .note { font-size: 11px; color: var(--muted); margin-top: 6px; }
              .yes { color: #166534; font-weight: 600; }
              .no  { color: #9b2c3c; }
              @media print {
                body { padding: 0; }
                h2 { page-break-after: avoid; }
                section { page-break-before: auto; }
                /* On paper the cover takes the sheet it is printed on,
                   which vh does not describe. */
                .cover { min-height: 0; height: auto; }
              }
            </style>
            """);

        html.Append("</head><body>");
    }

    /// <summary>
    /// The cover, on a page of its own.
    ///
    /// A report that is handed on, printed and filed wants a front:
    /// which programme this is, who ran it, when and where, with nothing
    /// else competing for the first thing a reader sees. The sections
    /// start on the page after it.
    /// </summary>
    private static void Cover(StringBuilder html, Source s)
    {
        var p = s.Programme;

        html.Append("<div class=\"cover\">");

        html.Append("<div class=\"cover__top\">");
        html.Append("<p class=\"cover__org\">Ministry of Micro, Small and Medium Enterprises</p>");
        html.Append("<p class=\"cover__sub\">Capacity Building Management System</p>");
        html.Append("</div>");

        html.Append("<div class=\"cover__mid\">");
        html.Append("<p class=\"cover__kicker\">Programme report</p>");
        html.Append("<h1>").Append(E(p.ProgrammeName)).Append("</h1>");
        html.Append("<p class=\"cover__code\">").Append(E(p.ProgrammeId)).Append("</p>");

        html.Append("<table class=\"cover__facts\"><tbody>");
        Row(html, "Programme type", p.ProgramType?.Name);
        Row(html, "Implementing agency", p.Agency?.Name);
        Row(html, "Coordinator", s.CoordinatorName);
        Row(html, "Held", Range(p.StartDate, p.EndDate));
        Row(html, "Mode", p.Mode.ToString());

        var where = new List<string>();
        if (!string.IsNullOrWhiteSpace(s.Venue?.Name)) where.Add(s.Venue!.Name);
        else if (!string.IsNullOrWhiteSpace(p.Venue)) where.Add(p.Venue!);
        if (!string.IsNullOrWhiteSpace(s.Venue?.Address)) where.Add(s.Venue!.Address);
        if (!string.IsNullOrWhiteSpace(p.State?.Name)) where.Add(p.State!.Name);
        Row(html, "Venue", where.Count > 0 ? string.Join(", ", where) : null);

        Row(html, "Position",
            s.Venue?.Latitude is { } lat && s.Venue?.Longitude is { } lon
                ? $"{Six(lat)}, {Six(lon)}"
                : null);

        Row(html, "Participants",
            $"{s.Participants.Count(x => x.IsPresent == true)} present of {s.Participants.Count} registered");

        Row(html, "Quality check", s.Submission.QcStatus.ToString()
            + (s.Submission.QcOn is { } on ? ", " + Email.IndianTime.Format(on) : string.Empty));
        html.Append("</tbody></table>");
        html.Append("</div>");

        html.Append("<p class=\"cover__foot\">Generated ")
            .Append(E(Email.IndianTime.Format(DateTime.UtcNow)))
            .Append(" from the sealed monitoring record.</p>");

        html.Append("</div>");
    }

    private static void VenueSection(StringBuilder html, Source s, ref long budget)
    {
        html.Append("<section><h2>Venue</h2>");

        var v = s.Venue;
        if (v is null)
        {
            html.Append("<p class=\"none\">No venue was recorded.</p></section>");
            return;
        }

        html.Append("<table><tbody>");
        Row(html, "Name", v.Name);
        Row(html, "Address", v.Address);
        Row(html, "Landmark", v.Landmark);
        Row(html, "Position", v.Latitude is { } la && v.Longitude is { } lo
            ? $"{Six(la)}, {Six(lo)}"
            : null);
        Row(html, "Accuracy", v.AccuracyMetres is { } m
            ? m.ToString("0.#", CultureInfo.InvariantCulture) + " m"
            : null);
        Row(html, "Geo-tagged", v.GeoTaggedOn is { } g ? Email.IndianTime.Format(g) : null);
        html.Append("</tbody></table>");

        Shots(html, s, [MonitoringPhotoKind.VenueExterior, MonitoringPhotoKind.VenueInterior],
            null, ref budget);

        html.Append("</section>");
    }

    private static void Trainers(StringBuilder html, Source s, ref long budget)
    {
        html.Append("<section><h2>Trainers</h2>");

        if (s.Trainers.Count == 0)
        {
            html.Append("<p class=\"none\">No trainer was recorded.</p></section>");
            return;
        }

        var n = 0;
        foreach (var t in s.Trainers)
        {
            n++;
            html.Append("<div class=\"entry\"><h3>Trainer ").Append(n).Append("</h3>");
            html.Append("<table><tbody>");
            Row(html, "Name", t.FullName);
            Row(html, "Designation", t.Designation);
            Row(html, "Organisation", t.Organisation);
            Row(html, "Email", t.Email);
            Row(html, "Contact", t.Mobile);
            html.Append("</tbody></table></div>");
        }

        html.Append("</section>");
    }

    /// <summary>
    /// The register: a column per day of the programme.
    ///
    /// A five-day programme is five separate questions, and somebody who
    /// came on Monday and not on Thursday did not attend it the way a
    /// single tick would claim. A one-day programme gets one column,
    /// which is the same table with nothing special about it.
    ///
    /// Three states per cell, not two. A day nobody marked is blank — it
    /// means the register was not taken, which is a different thing from
    /// a day everybody missed, and a report that confuses the two is
    /// evidence of the wrong thing.
    /// </summary>
    private static void Attendance(StringBuilder html, Source s, ref long budget)
    {
        html.Append("<section><h2>Attendance</h2>");

        if (s.Participants.Count == 0)
        {
            html.Append("<p class=\"none\">Nobody was registered on the spot.</p></section>");
            return;
        }

        var days = Days(s.Programme);
        var present = s.Participants.Count(p => p.IsPresent == true);

        html.Append("<p class=\"muted\">").Append(present).Append(" present of ")
            .Append(s.Participants.Count).Append(" registered, over ")
            .Append(days.Count).Append(days.Count == 1 ? " day." : " days.").Append("</p>");

        html.Append("<table><thead><tr><th class=\"n\">S.No</th><th>Participant</th>")
            .Append("<th>Enterprise</th>");

        foreach (var day in days)
        {
            html.Append("<th class=\"day\">")
                .Append(E(day.ToString("dd MMM", CultureInfo.InvariantCulture)))
                .Append("</th>");
        }

        html.Append("<th class=\"day\">Days</th></tr></thead><tbody>");

        var n = 0;
        foreach (var p in s.Participants)
        {
            n++;
            html.Append("<tr><td class=\"n\">").Append(n).Append("</td><td>")
                .Append(E(p.FullName)).Append("</td><td>")
                .Append(E(p.EnterpriseName)).Append("</td>");

            var came = 0;
            foreach (var day in days)
            {
                var mark = p.Days.FirstOrDefault(d => d.Day == day);
                if (mark?.IsPresent == true) came++;

                html.Append("<td class=\"day\">").Append(mark switch
                {
                    { IsPresent: true } => "<span class=\"yes\">P</span>",
                    { IsPresent: false } => "<span class=\"no\">A</span>",
                    /* Not taken. An em dash rather than a blank, so an
                       empty cell cannot be read as a printing fault. */
                    _ => "<span class=\"none\">—</span>",
                }).Append("</td>");
            }

            html.Append("<td class=\"day\">").Append(came).Append(" / ").Append(days.Count)
                .Append("</td></tr>");
        }

        html.Append("</tbody></table>");
        html.Append("<p class=\"note\">P present · A absent · — not taken</p>");

        Shots(html, s, [MonitoringPhotoKind.AttendanceSheet], "Signed sheet", ref budget);
        html.Append("</section>");
    }

    /// <summary>Every day the programme ran, first to last.</summary>
    private static List<DateOnly> Days(Programme programme)
    {
        var start = programme.StartDate;
        var end = programme.EndDate >= start ? programme.EndDate : start;

        var days = new List<DateOnly>();
        for (var day = start; day <= end && days.Count < 60; day = day.AddDays(1))
            days.Add(day);

        return days;
    }

    private static void Sessions(StringBuilder html, Source s, ref long budget)
    {
        html.Append("<section><h2>Sessions</h2>");

        if (s.Sessions.Count == 0)
        {
            html.Append("<p class=\"none\">No session was recorded.</p></section>");
            return;
        }

        var n = 0;
        foreach (var session in s.Sessions.OrderBy(x => x.ConductedOn).ThenBy(x => x.Id))
        {
            n++;
            html.Append("<div class=\"entry\"><h3>Session ").Append(n).Append("</h3>");
            html.Append("<table><tbody>");
            Row(html, "Date", Email.IndianTime.From(session.ConductedOn).ToString(
                "dd MMM yyyy, hh:mm tt", CultureInfo.InvariantCulture));
            Row(html, "Session", session.CurriculumSession?.SessionName);
            Row(html, "Topic", session.CurriculumTopic?.TopicName);
            Row(html, "Trainer", session.Trainer?.FullName);
            Row(html, "Comments", session.Comments);
            html.Append("</tbody></table>");

            var shots = s.Photos
                .Where(ph => ph.Kind == MonitoringPhotoKind.Session && ph.SessionId == session.Id)
                .ToList();

            if (shots.Count > 0) Embed(html, s, shots, null, ref budget);
            html.Append("</div>");
        }

        html.Append("</section>");
    }

    private static void Participants(StringBuilder html, Source s)
    {
        html.Append("<section><h2>Participants</h2>");

        if (s.Participants.Count == 0)
        {
            html.Append("<p class=\"none\">Nobody was registered on the spot.</p></section>");
            return;
        }

        html.Append("<table><thead><tr><th class=\"n\">S.No</th><th>Name</th>")
            .Append("<th>Enterprise</th><th>Udyam</th><th>Mobile</th><th>Email</th>")
            .Append("</tr></thead><tbody>");

        var n = 0;
        foreach (var p in s.Participants)
        {
            n++;
            html.Append("<tr><td class=\"n\">").Append(n).Append("</td>")
                .Append("<td>").Append(E(p.FullName)).Append("</td>")
                .Append("<td>").Append(E(p.EnterpriseName)).Append("</td>")
                .Append("<td>").Append(E(p.UdyamNumber)).Append("</td>")
                .Append("<td>").Append(E(p.Mobile)).Append("</td>")
                .Append("<td>").Append(E(p.Email)).Append("</td></tr>");
        }

        html.Append("</tbody></table></section>");
    }

    private static void Decision(StringBuilder html, Source s)
    {
        html.Append("<section><h2>Submission and quality control</h2><table><tbody>");

        Row(html, "Submitted on", Email.IndianTime.Format(s.Submission.SubmittedOn));
        Row(html, "Submitted by", s.CoordinatorName);
        Row(html, "Coordinator's remarks", s.Submission.Remarks);
        Row(html, "QC status", s.Submission.QcStatus.ToString());
        Row(html, "QC on", s.Submission.QcOn is { } on ? Email.IndianTime.Format(on) : null);
        Row(html, "QC by", s.Submission.QcByUserName);
        Row(html, "QC remarks", s.Submission.QcRemarks);

        html.Append("</tbody></table></section>");
    }

    /* ---------------------------------------------------------- helpers */

    private static void Shots(
        StringBuilder html, Source s, MonitoringPhotoKind[] kinds, string? label, ref long budget)
    {
        var shots = s.Photos.Where(p => kinds.Contains(p.Kind)).ToList();
        if (shots.Count == 0) return;
        Embed(html, s, shots, label, ref budget);
    }

    private static void Embed(
        StringBuilder html, Source s, IReadOnlyList<MonitoringPhoto> shots,
        string? label, ref long budget)
    {
        html.Append("<div class=\"shots\">");
        var skipped = 0;

        foreach (var shot in shots)
        {
            var bytes = budget > 0 ? s.ReadPhoto(shot) : null;
            if (bytes is null || bytes.Length > budget)
            {
                skipped++;
                continue;
            }

            budget -= bytes.Length;

            html.Append("<figure><img alt=\"\" src=\"data:")
                .Append(E(shot.ContentType)).Append(";base64,")
                .Append(Convert.ToBase64String(bytes)).Append("\">");

            html.Append("<figcaption>");
            html.Append(E(label ?? Readable(shot.Kind)));
            html.Append("<br>").Append(E(Email.IndianTime.Format(shot.CapturedOn)));
            if (shot.Latitude is { } la && shot.Longitude is { } lo)
                html.Append("<br>").Append(Six(la)).Append(", ").Append(Six(lo));
            html.Append("</figcaption></figure>");
        }

        html.Append("</div>");

        if (skipped > 0)
        {
            html.Append("<p class=\"note\">")
                .Append(skipped)
                .Append(skipped == 1
                    ? " photograph is not included here: it could not be read, or the report had "
                    : " photographs are not included here: they could not be read, or the report had ")
                .Append("reached the size at which embedding stops. They remain on the programme.")
                .Append("</p>");
        }
    }

    private static void Row(StringBuilder html, string label, string? value)
    {
        html.Append("<tr><th style=\"width:210px\">").Append(E(label)).Append("</th><td>");
        html.Append(string.IsNullOrWhiteSpace(value)
            ? "<span class=\"none\">Not recorded</span>"
            : E(value));
        html.Append("</td></tr>");
    }

    private static string Readable(MonitoringPhotoKind kind) => kind switch
    {
        MonitoringPhotoKind.VenueExterior => "Venue, exterior",
        MonitoringPhotoKind.VenueInterior => "Venue, interior",
        MonitoringPhotoKind.Session => "Session",
        MonitoringPhotoKind.Participant => "Participant",
        MonitoringPhotoKind.AttendanceSheet => "Attendance sheet",
        _ => "Photograph",
    };

    private static string Range(DateOnly? from, DateOnly? to)
    {
        if (from is null && to is null) return "—";
        if (from is null) return to!.Value.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
        if (to is null || to == from) return from.Value.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);

        return from.Value.ToString("dd MMM yyyy", CultureInfo.InvariantCulture)
               + " – " + to.Value.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
    }

    private static string Six(decimal value) =>
        value.ToString("0.000000", CultureInfo.InvariantCulture);

    private static string E(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);

    private static string Safe(string value) =>
        string.Concat(value.Select(c => char.IsLetterOrDigit(c) || c is '-' or '_' ? c : '-'));
}
