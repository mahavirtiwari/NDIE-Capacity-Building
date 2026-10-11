using Microsoft.EntityFrameworkCore;
using Ntms.Domain.Common;
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
/// session with the hours it runs and the topics under it, under a header
/// carrying the dates, the venue and who to ring. Everything on it is
/// already in the system — this only puts it on one page somebody can keep
/// on their phone or print and bring with them.
///
/// It is drawn in the portal's own palette, from the same tokens the
/// screens use, so a document that arrives by e-mail is recognisably the
/// same product as the one they signed in to. The organisation's name is
/// read from the branding record rather than written here, because the
/// branding is the Super Admin's and not the code's.
///
/// Built when it is sent rather than stored: a curriculum can be edited,
/// and the schedule somebody was sent should be the one that was true when
/// they registered.
/// </summary>
public class ProgrammeSchedulePdf(NtmsDbContext db)
{
    /* The portal's tokens, as PDFsharp colours. Names and values are
       _tokens.scss; a change there belongs here too, which is cheaper than
       the document drifting into a different crimson. */
    private static readonly XColor Brand700 = Rgb(0x82, 0x23, 0x2F);
    private static readonly XColor Brand600 = Rgb(0x9B, 0x2C, 0x3C);
    private static readonly XColor Brand100 = Rgb(0xF7, 0xDC, 0xE0);
    private static readonly XColor Brand50 = Rgb(0xFD, 0xF3, 0xF4);
    private static readonly XColor OnBrandSoft = Rgb(0xF0, 0xD6, 0xDA);
    private static readonly XColor Accent600 = Rgb(0xA3, 0x74, 0x0C);
    private static readonly XColor Ink900 = Rgb(0x1C, 0x1A, 0x1A);
    private static readonly XColor Ink600 = Rgb(0x57, 0x51, 0x4F);
    private static readonly XColor Ink500 = Rgb(0x7A, 0x71, 0x6F);
    private static readonly XColor Ink200 = Rgb(0xE6, 0xE0, 0xDE);
    private static readonly XColor White = Rgb(0xFF, 0xFF, 0xFF);

    private static XColor Rgb(byte r, byte g, byte b) => XColor.FromArgb(r, g, b);

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

    private const double Margin = 44;
    private const double TermColumn = 112;

    /// <summary>
    /// The schedule for one batch, or null where the batch has gone. A
    /// programme type whose plan has not been written yet still gets a
    /// page: the joining details are the half of it that always exists.
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
            .Where(s => s.Status == RecordStatus.Active)
            .OrderBy(s => s.Day ?? 0).ThenBy(s => s.DisplayOrder)
            .ToList() ?? [];

        var branding = await db.Branding.AsNoTracking()
            .Select(b => new { b.OrganisationName, b.PortalTitle })
            .FirstOrDefaultAsync(ct);

        EnsureFonts();

        using var document = new PdfDocument();
        document.Info.Title = $"{programme.ProgrammeName} — schedule";
        document.Info.Author = branding?.OrganisationName ?? "Capacity Building Management System";

        var sheet = new Sheet(document, branding?.OrganisationName, branding?.PortalTitle);

        /* ---- the masthead ------------------------------------------- */
        sheet.Masthead(programme.ProgrammeName, $"{programme.ProgrammeId} · {programme.ProgramType?.Name}");

        /* ---- what somebody needs on the morning --------------------- */
        var where = programme.Mode == ProgramMode.Virtual
            ? "Online"
            : string.Join(", ", new[]
            {
                programme.Venue,
                programme.City,
                programme.District?.Name,
                programme.State?.Name,
            }.Where(part => !string.IsNullOrWhiteSpace(part)));

        sheet.SectionTitle("Your program");

        var facts = new List<(string Term, string Value)>
        {
            ("Dates", $"{programme.StartDate:dd MMM yyyy} to {programme.EndDate:dd MMM yyyy}"),
            ("Timing", $"{programme.StartTime:HH\\:mm} to {programme.EndTime:HH\\:mm} each day"),
            ("Mode", programme.Mode.ToString()),
            ("Venue", string.IsNullOrWhiteSpace(where) ? "To be confirmed" : where),
        };

        if (programme.Mode == ProgramMode.Virtual && !string.IsNullOrWhiteSpace(programme.MeetingLink))
            facts.Add(("Join link", programme.MeetingLink!));

        facts.Add(("Conducted by", programme.Agency?.Name ?? "—"));

        if (programme.Coordinator is { } coordinator)
        {
            facts.Add(("Coordinator", coordinator.FullName));
            facts.Add(("Telephone", coordinator.Mobile));
            facts.Add(("E-mail", coordinator.Email));
        }

        sheet.Facts(facts);

        /* ---- the plan ------------------------------------------------ */
        sheet.SectionTitle("Program schedule");

        if (sessions.Count == 0)
        {
            sheet.Note(
                "The session plan for this program has not been published yet. Your "
                + "coordinator will share it before the program begins.");
        }

        var day = -1;
        foreach (var session in sessions)
        {
            var topics = session.Topics
                .Where(t => t.Status == RecordStatus.Active)
                .OrderBy(t => t.DisplayOrder)
                .Select(t => t.DurationMinutes is { } minutes
                    ? $"{t.TopicName}  ({minutes} min)"
                    : t.TopicName)
                .ToList();

            if (session.Day is { } onDay && onDay != day)
            {
                day = onDay;
                sheet.DayBand($"Day {onDay}");
            }

            var hours = session.StartTime is null
                ? string.Empty
                : session.EndTime is null
                    ? $"{session.StartTime:HH\\:mm}"
                    : $"{session.StartTime:HH\\:mm} – {session.EndTime:HH\\:mm}";

            sheet.Session(hours, session.SessionName, topics);
        }

        sheet.Finish();

        using var buffer = new MemoryStream();
        document.Save(buffer, false);

        var name = $"Schedule-{programme.ProgrammeId.Replace('/', '-')}.pdf";
        return new EmailAttachment(name, "application/pdf", buffer.ToArray());
    }

    /// <summary>
    /// A page being written down, in the portal's colours.
    ///
    /// It knows where it is on the sheet and when to start another one, so
    /// the caller above reads as the document rather than as arithmetic.
    /// </summary>
    private sealed class Sheet
    {
        private readonly PdfDocument document;
        private readonly string organisation;
        private readonly string? portalTitle;

        private PdfPage page = null!;
        private XGraphics gfx = null!;
        private XTextFormatter text = null!;
        private double y;
        private double right;

        private readonly XFont title = new("Arial", 17, XFontStyleEx.Bold);
        private readonly XFont section = new("Arial", 11, XFontStyleEx.Bold);
        private readonly XFont strong = new("Arial", 9.5, XFontStyleEx.Bold);
        private readonly XFont body = new("Arial", 9.5, XFontStyleEx.Regular);
        private readonly XFont small = new("Arial", 8.5, XFontStyleEx.Regular);
        private readonly XFont tiny = new("Arial", 7.5, XFontStyleEx.Regular);

        public Sheet(PdfDocument document, string? organisation, string? portalTitle)
        {
            this.document = document;
            this.organisation = string.IsNullOrWhiteSpace(organisation)
                ? "Capacity Building Management System"
                : organisation;
            this.portalTitle = portalTitle;
            NewPage(first: true);
        }

        private void NewPage(bool first = false)
        {
            if (!first) gfx.Dispose();

            page = document.AddPage();
            page.Size = PdfSharp.PageSize.A4;
            gfx = XGraphics.FromPdfPage(page);
            text = new XTextFormatter(gfx);
            right = page.Width.Point - Margin;

            /* The crimson band across the top of every page, which is what
               the portal's own header looks like. */
            gfx.DrawRectangle(new XSolidBrush(Brand700), 0, 0, page.Width.Point, 8);
            y = 44;

            if (!first)
            {
                /* Carried over, so a second page is not an orphan. */
                gfx.DrawString(organisation, tiny, new XSolidBrush(Ink500), new XPoint(Margin, 26));
            }
        }

        private void Room(double needed)
        {
            if (y + needed <= page.Height.Point - 54) return;
            NewPage();
        }

        public void Masthead(string name, string subtitle)
        {
            gfx.DrawString(organisation.ToUpperInvariant(), tiny, new XSolidBrush(Brand600),
                new XPoint(Margin, y));
            y += 6;

            if (!string.IsNullOrWhiteSpace(portalTitle))
            {
                gfx.DrawString(portalTitle!, tiny, new XSolidBrush(Ink500), new XPoint(Margin, y + 9));
                y += 9;
            }

            y += 22;
            text.DrawString(name, title, new XSolidBrush(Ink900),
                new XRect(Margin, y - 14, right - Margin, 44), XStringFormats.TopLeft);
            y += Lines(name, title, right - Margin) * 19;

            gfx.DrawString(subtitle, small, new XSolidBrush(Ink600), new XPoint(Margin, y));
            y += 10;

            /* The gold rule under the masthead: the one accent in the
               palette, used here exactly as the portal uses it. */
            gfx.DrawLine(new XPen(Accent600, 1.4), Margin, y, Margin + 54, y);
            y += 20;
        }

        public void SectionTitle(string label)
        {
            Room(40);
            gfx.DrawString(label, section, new XSolidBrush(Brand700), new XPoint(Margin, y));
            y += 7;
            gfx.DrawLine(new XPen(Ink200, 0.8), Margin, y, right, y);
            y += 14;
        }

        public void Facts(IEnumerable<(string Term, string Value)> facts)
        {
            var striped = false;
            foreach (var (term, value) in facts)
            {
                var height = Math.Max(16, Lines(value, body, right - Margin - TermColumn) * 13 + 5);
                Room(height);

                /* Alternate rows on the palest brand tint, which is what a
                   table looks like on screen. */
                if (striped)
                {
                    gfx.DrawRectangle(new XSolidBrush(Brand50),
                        Margin - 6, y - 10, right - Margin + 12, height);
                }
                striped = !striped;

                gfx.DrawString(term, strong, new XSolidBrush(Ink600), new XPoint(Margin, y));
                text.DrawString(value, body, new XSolidBrush(Ink900),
                    new XRect(Margin + TermColumn, y - 10, right - Margin - TermColumn, height + 4),
                    XStringFormats.TopLeft);

                y += height;
            }

            y += 14;
        }

        public void Note(string words)
        {
            Room(40);
            var height = Lines(words, body, right - Margin - 20) * 13 + 14;
            gfx.DrawRectangle(new XPen(Brand100, 0.8), new XSolidBrush(Brand50),
                Margin, y - 10, right - Margin, height);
            text.DrawString(words, body, new XSolidBrush(Ink600),
                new XRect(Margin + 10, y - 3, right - Margin - 20, height), XStringFormats.TopLeft);
            y += height + 10;
        }

        public void DayBand(string label)
        {
            Room(46);
            y += 4;
            gfx.DrawRectangle(new XSolidBrush(Brand700), Margin, y - 11, right - Margin, 20);
            gfx.DrawString(label, strong, new XSolidBrush(White), new XPoint(Margin + 10, y + 3));
            y += 28;
        }

        public void Session(string hours, string name, IReadOnlyList<string> topics)
        {
            var width = right - Margin - TermColumn;
            var needed = Lines(name, strong, width) * 13
                         + topics.Sum(topic => Lines(topic, small, width - 10) * 12)
                         + 16;
            Room(needed);

            gfx.DrawString(hours, small, new XSolidBrush(Brand600), new XPoint(Margin + 4, y));
            text.DrawString(name, strong, new XSolidBrush(Ink900),
                new XRect(Margin + TermColumn, y - 10, width, 40), XStringFormats.TopLeft);
            y += Lines(name, strong, width) * 13 + 2;

            foreach (var topic in topics)
            {
                var height = Lines(topic, small, width - 10) * 12;

                /* A small square in the brand tint instead of a bullet: a
                   dot is a dot, and this matches the chips on screen. */
                gfx.DrawRectangle(new XSolidBrush(Brand100), Margin + TermColumn, y - 5, 4, 4);
                text.DrawString(topic, small, new XSolidBrush(Ink600),
                    new XRect(Margin + TermColumn + 10, y - 8, width - 10, height + 6),
                    XStringFormats.TopLeft);

                y += height;
            }

            y += 10;
            gfx.DrawLine(new XPen(Ink200, 0.6), Margin + TermColumn, y - 4, right, y - 4);
        }

        /// <summary>The footer, on every page, once nothing more will be drawn.</summary>
        public void Finish()
        {
            /* The open page first: PDFsharp allows one XGraphics on a page
               at a time, and the footer loop below opens every page again
               to append to what is already drawn on it. */
            gfx.Dispose();

            for (var index = 0; index < document.PageCount; index++)
            {
                var each = document.Pages[index];
                using var footer = XGraphics.FromPdfPage(each, XGraphicsPdfPageOptions.Append);
                var line = each.Height.Point - 36;

                footer.DrawLine(new XPen(Ink200, 0.6), Margin, line, each.Width.Point - Margin, line);
                footer.DrawString(
                    $"{organisation} · generated {DateTime.UtcNow.AddHours(5.5):dd MMM yyyy}",
                    tiny, new XSolidBrush(Ink500), new XPoint(Margin, line + 14));
                footer.DrawString($"Page {index + 1} of {document.PageCount}", tiny,
                    new XSolidBrush(Ink500),
                    new XRect(Margin, line + 4, each.Width.Point - (Margin * 2), 14),
                    XStringFormats.TopRight);

                /* A thin brand rule down the outside edge, the quietest way
                   to say the page belongs to the portal. */
                footer.DrawRectangle(new XSolidBrush(OnBrandSoft),
                    each.Width.Point - 6, 8, 6, each.Height.Point - 16);
            }
        }

        /// <summary>How many lines a run of text takes once it has wrapped.</summary>
        private double Lines(string words, XFont font, double width)
        {
            var size = gfx.MeasureString(words, font);
            return Math.Max(1, Math.Ceiling(size.Width / Math.Max(1, width)));
        }
    }
}
