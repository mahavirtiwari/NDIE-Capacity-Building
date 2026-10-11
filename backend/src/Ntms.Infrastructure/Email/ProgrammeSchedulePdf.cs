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

        /* The marks as well as the names. Both are the Super Admin's
           upload and neither is a checked-in asset, so the document is
           whatever branding the installation is actually wearing. */
        var branding = await db.Branding.AsNoTracking()
            .Select(b => new
            {
                b.OrganisationName,
                b.LogoData,
                b.LogoContentType,
                b.PartnerLogoData,
                b.PartnerLogoContentType,
            })
            .FirstOrDefaultAsync(ct);

        EnsureFonts();

        using var document = new PdfDocument();
        document.Info.Title = $"{programme.ProgrammeName} — schedule";
        document.Info.Author = branding?.OrganisationName ?? "Capacity Building Management System";

        var sheet = new Sheet(
            document,
            branding?.OrganisationName,
            Mark(branding?.LogoData, branding?.LogoContentType),
            Mark(branding?.PartnerLogoData, branding?.PartnerLogoContentType));

        /* ---- the masthead ------------------------------------------- */
        sheet.Masthead(programme.ProgrammeName);

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

        sheet.SectionTitle("Program details");

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

        sheet.Finish(sessions.Count);

        using var buffer = new MemoryStream();
        document.Save(buffer, false);

        var name = $"Schedule-{programme.ProgrammeId.Replace('/', '-')}.pdf";
        return new EmailAttachment(name, "application/pdf", buffer.ToArray());
    }

    /// <summary>
    /// An uploaded mark as something that can be drawn, or null.
    ///
    /// PDFsharp reads PNG and JPEG and nothing else, and a logo may well
    /// have been uploaded as SVG — which the browser is happy with and
    /// this is not. A mark it cannot read is no mark: the masthead falls
    /// back to the organisation's name, which is never missing.
    /// </summary>
    private static XImage? Mark(byte[]? data, string? contentType)
    {
        if (data is not { Length: > 0 }) return null;

        var type = (contentType ?? string.Empty).ToLowerInvariant();
        if (type is not ("image/png" or "image/jpeg" or "image/jpg")) return null;

        try
        {
            /* The stream has to outlive this call: PDFsharp reads it when
               the image is drawn, not when it is loaded, and it is
               disposed with the document. */
            return XImage.FromStream(new MemoryStream(data));
        }
        catch
        {
            /* A file that claims to be a PNG and is not. */
            return null;
        }
    }

    /// <summary>
    /// A page being written down, in the portal's colours.
    ///
    /// Everything is laid out from the top of the next element rather than
    /// from a baseline, so a block that wraps to three lines pushes what
    /// follows down by three lines. Measuring from baselines is what put a
    /// session heading on top of the rule above it.
    ///
    /// The sheet also knows when it is full. A schedule is as long as the
    /// curriculum is, so a second and third page are ordinary: each one
    /// carries the programme's name at the top, the day is restated where
    /// one runs across the fold, and nothing is drawn into the footer.
    /// </summary>
    private sealed class Sheet
    {
        private readonly PdfDocument document;
        private readonly string organisation;
        private readonly XImage? logo;
        private readonly XImage? partner;

        private PdfPage page = null!;
        private XGraphics gfx = null!;
        private XTextFormatter text = null!;
        private double y;
        private double right;

        /// <summary>What the pages after the first say they are. </summary>
        private string continuation = string.Empty;

        /// <summary>The day being laid out, restated after a page break.</summary>
        private string? day;

        private readonly XFont title = new("Arial", 17, XFontStyleEx.Bold);
        private readonly XFont section = new("Arial", 11, XFontStyleEx.Bold);
        private readonly XFont strong = new("Arial", 9.5, XFontStyleEx.Bold);
        private readonly XFont body = new("Arial", 9.5, XFontStyleEx.Regular);
        private readonly XFont small = new("Arial", 8.5, XFontStyleEx.Regular);
        private readonly XFont tiny = new("Arial", 7.5, XFontStyleEx.Regular);

        public Sheet(PdfDocument document, string? organisation, XImage? logo, XImage? partner)
        {
            this.document = document;
            this.organisation = string.IsNullOrWhiteSpace(organisation)
                ? "Capacity Building Management System"
                : organisation;
            this.logo = logo;
            this.partner = partner;
            NewPage(first: true);
        }

        /* Tall enough to be read on a printed page, short enough that the
           masthead does not take the first third of it. */
        private const double LogoHeight = 36;
        private const double PartnerHeight = 26;

        /// <summary>Where the footer starts; nothing is drawn below this.</summary>
        private double Floor => page.Height.Point - 64;

        /// <summary>The width a mark takes at that height, aspect kept.</summary>
        private static double Scale(XImage mark, double height) =>
            mark.PixelHeight > 0 ? height * mark.PixelWidth / mark.PixelHeight : height;

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
            y = 40;

            if (first) return;

            /* A continued page says what it is continuing, so a printed
               stack of them cannot be shuffled into nonsense. */
            gfx.DrawString(continuation, small, new XSolidBrush(Ink600),
                new XPoint(Margin, y), XStringFormats.TopLeft);
            gfx.DrawString("continued", small, new XSolidBrush(Ink500),
                new XRect(Margin, y, right - Margin, 12), XStringFormats.TopRight);
            y += 16;
            gfx.DrawLine(new XPen(Ink200, 0.8), Margin, y, right, y);
            y += 16;

            /* And which day, where one runs across the fold. */
            if (day is not null) Band($"{day} (continued)");
        }

        /// <summary>Starts a page where what comes next will not fit.</summary>
        private void Room(double needed)
        {
            if (y + needed <= Floor) return;
            NewPage();
        }

        /// <summary>
        /// A run of text from the current cursor, wrapped inside a width.
        /// Returns the height it took, which is what the caller moves by.
        /// </summary>
        private double Block(
            string words, XFont font, XColor colour, double x, double width,
            XParagraphAlignment align = XParagraphAlignment.Left)
        {
            var height = Height(words, font, width);
            text.Alignment = align;
            text.DrawString(words, font, new XSolidBrush(colour),
                new XRect(x, y, width, height + font.GetHeight()), XStringFormats.TopLeft);
            text.Alignment = XParagraphAlignment.Left;
            return height;
        }

        /// <summary>How tall a run of text is once it has wrapped.</summary>
        private double Height(string words, XFont font, double width) =>
            Lines(words, font, width) * (font.GetHeight() + 1.5);

        private double Lines(string words, XFont font, double width)
        {
            var measured = gfx.MeasureString(words, font).Width;
            return Math.Max(1, Math.Ceiling(measured / Math.Max(1, width)));
        }

        /// <summary>
        /// The mark, then the programme, centred.
        ///
        /// The logo carries the organisation's name inside the artwork, so
        /// spelling it out underneath said the same thing twice, and the
        /// portal's own title belongs on the portal rather than on a
        /// timetable somebody prints and brings with them.
        /// </summary>
        public void Masthead(string name)
        {
            continuation = name;

            var middle = (Margin + right) / 2;

            if (logo is not null)
            {
                var width = Scale(logo, LogoHeight);

                /* Both marks centred as a pair where there is a partner,
                   so the header stays balanced rather than centring one
                   and hanging the other off the edge. */
                if (partner is not null)
                {
                    var partnerWidth = Scale(partner, PartnerHeight);
                    var together = width + 26 + partnerWidth;
                    var start = middle - (together / 2);

                    gfx.DrawImage(logo, start, y, width, LogoHeight);
                    gfx.DrawImage(partner, start + width + 26,
                        y + ((LogoHeight - PartnerHeight) / 2), partnerWidth, PartnerHeight);
                }
                else
                {
                    gfx.DrawImage(logo, middle - (width / 2), y, width, LogoHeight);
                }

                /* Room to breathe under the mark: the name used to sit on
                   the artwork's shoulder. */
                y += LogoHeight + 26;
            }
            else
            {
                /* Nothing uploaded. The name is the mark, and it is the one
                   thing that is never missing. */
                y += Block(organisation.ToUpperInvariant(), small, Brand600,
                    Margin, right - Margin, XParagraphAlignment.Center) + 18;
            }

            y += Block(name, title, Ink900, Margin, right - Margin, XParagraphAlignment.Center);
            y += 10;

            /* The gold rule under the masthead: the one accent in the
               palette, used here exactly as the portal uses it. */
            gfx.DrawLine(new XPen(Accent600, 1.4), middle - 27, y, middle + 27, y);
            y += 26;
        }

        public void SectionTitle(string label)
        {
            Room(56);
            y += Block(label, section, Brand700, Margin, right - Margin);
            y += 5;
            gfx.DrawLine(new XPen(Ink200, 0.8), Margin, y, right, y);
            y += 12;
        }

        public void Facts(IEnumerable<(string Term, string Value)> facts)
        {
            var striped = false;
            foreach (var (term, value) in facts)
            {
                var width = right - Margin - TermColumn;
                var height = Math.Max(Height(value, body, width), body.GetHeight()) + 7;
                Room(height);

                /* Alternate rows on the palest brand tint, which is what a
                   table looks like on screen. */
                if (striped)
                {
                    gfx.DrawRectangle(new XSolidBrush(Brand50),
                        Margin - 6, y - 3, right - Margin + 12, height);
                }
                striped = !striped;

                Block(term, strong, Ink600, Margin, TermColumn - 8);
                Block(value, body, Ink900, Margin + TermColumn, width);

                y += height;
            }

            y += 18;
        }

        public void Note(string words)
        {
            var width = right - Margin - 24;
            var height = Height(words, body, width) + 20;
            Room(height);

            gfx.DrawRectangle(new XPen(Brand100, 0.8), new XSolidBrush(Brand50),
                Margin, y, right - Margin, height);

            y += 10;
            Block(words, body, Ink600, Margin + 12, width);
            y += height - 10 + 8;
        }

        /// <summary>The crimson band that opens a day.</summary>
        public void DayBand(string label)
        {
            day = label;
            Room(54);
            Band(label);
        }

        private void Band(string label)
        {
            gfx.DrawRectangle(new XSolidBrush(Brand700), Margin, y, right - Margin, 21);
            gfx.DrawString(label, strong, new XSolidBrush(White),
                new XPoint(Margin + 10, y + 5), XStringFormats.TopLeft);
            y += 21 + 14;
        }

        /// <summary>
        /// One session: the hours in the left column, the name beside them
        /// and the topics under it, closed by a hairline.
        /// </summary>
        public void Session(string hours, string name, IReadOnlyList<string> topics)
        {
            var width = right - Margin - TermColumn;

            var needed = Height(name, strong, width)
                         + topics.Sum(topic => Height(topic, small, width - 14))
                         + 26;

            /* Kept whole where it can be. A session split across the fold
               leaves a heading alone at the bottom of a page, and the day
               is restated at the top of the next one anyway. */
            Room(Math.Min(needed, Floor - 120));

            if (hours.Length > 0)
            {
                gfx.DrawString(hours, small, new XSolidBrush(Brand600),
                    new XPoint(Margin + 4, y + 1), XStringFormats.TopLeft);
            }

            y += Block(name, strong, Ink900, Margin + TermColumn, width) + 3;

            foreach (var topic in topics)
            {
                /* A small square in the brand tint instead of a bullet: a
                   dot is a dot, and this matches the chips on screen. */
                gfx.DrawRectangle(new XSolidBrush(Brand100), Margin + TermColumn, y + 3.5, 4, 4);
                y += Block(topic, small, Ink600, Margin + TermColumn + 14, width - 14);
            }

            y += 9;
            gfx.DrawLine(new XPen(Ink200, 0.6), Margin + TermColumn, y, right, y);
            y += 13;
        }

        /// <summary>Nothing further belongs to a day after this.</summary>
        public void EndOfPlan() => day = null;

        /// <summary>
        /// The footer, on every page, once nothing more will be drawn.
        /// </summary>
        public void Finish(int sessionCount)
        {
            /* The open page first: PDFsharp allows one XGraphics on a page
               at a time, and the loop below opens every page again to
               append to what is already drawn on it. */
            gfx.Dispose();

            for (var index = 0; index < document.PageCount; index++)
            {
                var each = document.Pages[index];
                using var footer = XGraphics.FromPdfPage(each, XGraphicsPdfPageOptions.Append);
                var line = each.Height.Point - 40;

                footer.DrawLine(new XPen(Ink200, 0.6), Margin, line, each.Width.Point - Margin, line);
                footer.DrawString(
                    $"{organisation} · generated {DateTime.UtcNow.AddHours(5.5):dd MMM yyyy}",
                    tiny, new XSolidBrush(Ink500),
                    new XPoint(Margin, line + 8), XStringFormats.TopLeft);
                footer.DrawString($"Page {index + 1} of {document.PageCount}", tiny,
                    new XSolidBrush(Ink500),
                    new XRect(Margin, line + 8, each.Width.Point - (Margin * 2), 12),
                    XStringFormats.TopRight);

                /* A thin brand rule down the outside edge, the quietest way
                   to say the page belongs to the portal. */
                footer.DrawRectangle(new XSolidBrush(OnBrandSoft),
                    each.Width.Point - 6, 8, 6, each.Height.Point - 16);
            }

            _ = sessionCount;
        }
    }
}
