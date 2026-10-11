using Microsoft.EntityFrameworkCore;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;
using PdfSharp.Drawing;
using PdfSharp.Drawing.Layout;
using PdfSharp.Fonts;
using PdfSharp.Pdf;
using PdfSharp.Snippets.Font;

namespace Ntms.Infrastructure.Email;

/// <summary>
/// The timetable a participant is sent when they register, as a PDF.
///
/// It is the curriculum for the programme type, laid out day by day: each
/// session with the hours it runs and the topics under it, over a header
/// carrying the dates, the venue and who to ring. Everything on it is
/// already in the system — this only puts it on one page somebody can keep
/// on their phone or print and bring with them.
///
/// Built here rather than stored: a curriculum can be edited, and a
/// schedule generated at the moment of registering is the one that was
/// true when they registered.
/// </summary>
public class ProgrammeSchedulePdf(NtmsDbContext db)
{
    /* PDFsharp cannot find a font on its own outside Windows, and the API
       runs on a server where that cannot be assumed. The snippets resolver
       ships a usable family, and setting it twice throws, so it is set
       once for the process. */
    private static readonly object FontGate = new();
    private static bool _fontsReady;

    private static void EnsureFonts()
    {
        if (_fontsReady) return;
        lock (FontGate)
        {
            if (_fontsReady) return;
            GlobalFontSettings.FontResolver ??= new FailsafeFontResolver();
            _fontsReady = true;
        }
    }

    /// <summary>
    /// The schedule for one batch, or null where there is no curriculum to
    /// lay out. A programme type whose plan has not been written yet has
    /// nothing to attach, and an empty page is worse than no attachment.
    /// </summary>
    public async Task<EmailAttachment?> BuildAsync(int programmeId, CancellationToken ct)
    {
        var programme = await db.Programmes.AsNoTracking()
            .Include(p => p.ProgramType)
            .Include(p => p.Agency)
            .Include(p => p.Coordinator)
            .Include(p => p.State)
            .Include(p => p.District)
            .FirstOrDefaultAsync(p => p.Id == programmeId, ct);

        if (programme is null) return null;

        var curriculum = await db.Curricula.AsNoTracking()
            .Include(c => c.Sessions.OrderBy(s => s.DisplayOrder))
                .ThenInclude(s => s.Topics.OrderBy(t => t.DisplayOrder))
            .Where(c => c.ProgramTypeId == programme.ProgramTypeId)
            .OrderByDescending(c => c.EffectiveFrom)
            .FirstOrDefaultAsync(ct);

        var sessions = curriculum?.Sessions
            .Where(s => s.Status == Domain.Common.RecordStatus.Active)
            .OrderBy(s => s.Day ?? 0).ThenBy(s => s.DisplayOrder)
            .ToList() ?? [];

        EnsureFonts();

        using var document = new PdfDocument();
        document.Info.Title = $"{programme.ProgrammeName} — schedule";
        document.Info.Author = "Capacity Building Management System";

        var page = document.AddPage();
        page.Size = PdfSharp.PageSize.A4;

        var gfx = XGraphics.FromPdfPage(page);
        var writer = new XTextFormatter(gfx);

        var title = new XFont("Arial", 16, XFontStyleEx.Bold);
        var heading = new XFont("Arial", 10, XFontStyleEx.Bold);
        var body = new XFont("Arial", 9.5, XFontStyleEx.Regular);
        var small = new XFont("Arial", 8.5, XFontStyleEx.Regular);

        var ink = XBrushes.Black;
        var muted = new XSolidBrush(XColor.FromArgb(120, 112, 110));
        var rule = new XPen(XColor.FromArgb(220, 214, 212), 0.7);

        const double left = 48;
        var right = page.Width.Point - 48;
        var y = 52.0;

        gfx.DrawString(programme.ProgrammeName, title, ink, new XPoint(left, y));
        y += 18;
        gfx.DrawString(
            $"{programme.ProgrammeId} · {programme.ProgramType?.Name}", body, muted,
            new XPoint(left, y));
        y += 20;

        gfx.DrawLine(rule, left, y, right, y);
        y += 16;

        /* The facts somebody needs on the morning: when, where, and who to
           ring when they cannot find the building. */
        var where = programme.Mode == Domain.Common.ProgramMode.Virtual
            ? $"Online{(string.IsNullOrWhiteSpace(programme.MeetingLink) ? "" : $" · {programme.MeetingLink}")}"
            : string.Join(", ", new[]
            {
                programme.Venue,
                programme.City,
                programme.District?.Name,
                programme.State?.Name,
            }.Where(part => !string.IsNullOrWhiteSpace(part)));

        var facts = new List<(string Term, string Value)>
        {
            ("Dates", $"{programme.StartDate:dd MMM yyyy} to {programme.EndDate:dd MMM yyyy}"),
            ("Reporting time", $"{programme.StartTime:hh\\:mm} to {programme.EndTime:hh\\:mm} each day"),
            ("Mode", programme.Mode.ToString()),
            ("Venue", string.IsNullOrWhiteSpace(where) ? "To be confirmed" : where),
            ("Conducted by", programme.Agency?.Name ?? "—"),
        };

        if (programme.Coordinator is { } coordinator)
        {
            facts.Add(("Coordinator", coordinator.FullName));
            facts.Add(("Contact", $"{coordinator.Mobile} · {coordinator.Email}"));
        }

        foreach (var (term, value) in facts)
        {
            gfx.DrawString(term, heading, muted, new XPoint(left, y));
            writer.DrawString(value, body, ink,
                new XRect(left + 110, y - 9, right - left - 110, 28), XStringFormats.TopLeft);
            y += Math.Max(16, Measure(gfx, value, body, right - left - 110));
        }

        y += 8;
        gfx.DrawLine(rule, left, y, right, y);
        y += 18;

        gfx.DrawString("Program schedule", title, ink, new XPoint(left, y));
        y += 18;

        if (sessions.Count == 0)
        {
            gfx.DrawString(
                "The session plan for this program has not been published yet. "
                + "Your coordinator will share it before the program begins.",
                body, muted, new XPoint(left, y));
        }

        var day = -1;
        foreach (var session in sessions)
        {
            /* A new page before a session is split across the fold. Each one
               is a heading, its hours and its topics, so the space it needs
               can be worked out before it is drawn. */
            var needed = 34 + (session.Topics.Count(t => t.Status == Domain.Common.RecordStatus.Active) * 14);
            if (y + needed > page.Height.Point - 60)
            {
                page = document.AddPage();
                page.Size = PdfSharp.PageSize.A4;
                gfx.Dispose();
                gfx = XGraphics.FromPdfPage(page);
                writer = new XTextFormatter(gfx);
                y = 52;
            }

            if (session.Day is { } onDay && onDay != day)
            {
                day = onDay;
                y += 6;
                gfx.DrawString($"Day {onDay}", heading, ink, new XPoint(left, y));
                y += 14;
            }

            var hours = session.StartTime is null
                ? string.Empty
                : session.EndTime is null
                    ? $"{session.StartTime:HH\\:mm}"
                    : $"{session.StartTime:HH\\:mm} – {session.EndTime:HH\\:mm}";

            gfx.DrawString(hours, body, muted, new XPoint(left + 8, y));
            writer.DrawString(session.SessionName, heading, ink,
                new XRect(left + 110, y - 9, right - left - 110, 26), XStringFormats.TopLeft);
            y += Math.Max(15, Measure(gfx, session.SessionName, heading, right - left - 110));

            foreach (var topic in session.Topics
                         .Where(t => t.Status == Domain.Common.RecordStatus.Active)
                         .OrderBy(t => t.DisplayOrder))
            {
                var line = topic.DurationMinutes is { } minutes
                    ? $"• {topic.TopicName}  ({minutes} min)"
                    : $"• {topic.TopicName}";

                writer.DrawString(line, small, muted,
                    new XRect(left + 118, y - 8, right - left - 118, 24), XStringFormats.TopLeft);
                y += Math.Max(13, Measure(gfx, line, small, right - left - 118));
            }

            y += 6;
        }

        gfx.Dispose();

        using var buffer = new MemoryStream();
        document.Save(buffer, false);

        var name = $"Schedule-{programme.ProgrammeId.Replace('/', '-')}.pdf";
        return new EmailAttachment(name, "application/pdf", buffer.ToArray());
    }

    /// <summary>How tall a run of text will be once it has wrapped.</summary>
    private static double Measure(XGraphics gfx, string text, XFont font, double width)
    {
        var size = gfx.MeasureString(text, font);
        var lines = Math.Max(1, Math.Ceiling(size.Width / Math.Max(1, width)));
        return lines * (font.GetHeight() + 1);
    }
}
