using System.Text;
using System.Text.RegularExpressions;
using Ntms.Application.Common;
using Ntms.Domain.Common;

namespace Ntms.Infrastructure.Certificates;

/// <summary>
/// Turns an uploaded template and one recipient's details into a finished,
/// printable certificate.
///
/// The output is a self-contained HTML document sized to an A4 page. Everything
/// it needs is inlined — the background artwork as a data URI, the styles in a
/// &lt;style&gt; block — so the file can be saved, e-mailed or printed to PDF
/// from the browser without the server being reachable. A print stylesheet sets
/// the page size and removes margins, so "Save as PDF" produces the certificate
/// and nothing else.
///
/// Two kinds of template are understood:
///
/// <list type="bullet">
/// <item><b>HTML</b> — used as the body of the page. The designer controls the
/// whole layout and drops placeholders wherever they want them.</item>
/// <item><b>An image</b> (PNG or JPEG) — laid in as the full-bleed background
/// with the recipient's name and the certificate number placed over it.</item>
/// </list>
///
/// PDF and DOCX can be stored as templates but cannot be filled here: writing
/// into either needs a document library the project does not carry. Rendering
/// one is refused with that explanation rather than producing something wrong.
/// </summary>
public static class CertificateRenderer
{
    /// <summary>
    /// The values a template may refer to. Held as a dictionary rather than a
    /// typed model because the set is a published contract — the screen lists
    /// these names to whoever is designing the artwork, and both sides read the
    /// same list.
    /// </summary>
    public static IReadOnlyList<string> Placeholders =>
    [
        "recipientName", "certificateNumber", "kindLabel",
        "programmeName", "programmeCode", "programTypeName",
        "categoryName", "subCategoryName",
        "startDate", "endDate", "durationDays",
        "issuedOn", "validTill",
        "venue", "city", "state", "agencyName",
        "organisationName",
    ];

    /// <summary>A document ready to be shown, saved or printed.</summary>
    public sealed record Rendered(string Html, string FileName);

    public sealed record Template(string ContentType, byte[] Content);

    /// <summary>
    /// Builds one certificate. <paramref name="values"/> supplies the
    /// placeholders; anything a template asks for that is not supplied is left
    /// blank rather than printed as a raw <c>{{token}}</c>.
    /// </summary>
    public static Rendered Render(
        Template? template,
        CertificateKind kind,
        IReadOnlyDictionary<string, string> values,
        string fileName)
    {
        var body = BuildBody(template, kind, values);
        var html = Document(values.GetValueOrDefault("recipientName", "Certificate"), [body]);
        return new Rendered(html, fileName);
    }

    /// <summary>
    /// Several certificates in one document, one per page.
    ///
    /// A whole programme printed in a single pass is the difference between one
    /// trip to the printer and sixty, and the background is inlined once and
    /// shared by every page rather than repeated per certificate.
    /// </summary>
    public static Rendered RenderMany(
        Template? template,
        CertificateKind kind,
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        string title,
        string fileName)
    {
        var pages = rows.Select(values => BuildBody(template, kind, values)).ToList();
        return new Rendered(Document(title, pages), fileName);
    }

    /* ----------------------------------------------------------- internals */

    private static string BuildBody(
        Template? template, CertificateKind kind, IReadOnlyDictionary<string, string> values)
    {
        if (template is null) return Fallback(kind, values);

        var type = template.ContentType.ToLowerInvariant();

        if (type.Contains("html"))
        {
            return $"<section class=\"page\">{Fill(Encoding.UTF8.GetString(template.Content), values)}</section>";
        }

        if (type.Contains("png") || type.Contains("jpeg") || type.Contains("jpg"))
        {
            var uri = $"data:{template.ContentType};base64,{Convert.ToBase64String(template.Content)}";
            return $"""
                <section class="page page--art" style="background-image:url('{uri}')">
                  <div class="overlay">
                    <div class="overlay__name">{Escape(values.GetValueOrDefault("recipientName"))}</div>
                    <div class="overlay__line">{Escape(values.GetValueOrDefault("programmeName"))}</div>
                    <div class="overlay__foot">
                      <span>No. {Escape(values.GetValueOrDefault("certificateNumber"))}</span>
                      <span>{Escape(values.GetValueOrDefault("issuedOn"))}</span>
                    </div>
                  </div>
                </section>
                """;
        }

        throw new AppException(
            $"This programme's {kind.ToString().ToLowerInvariant()} template is a " +
            $"{Describe(template.ContentType)} file, which cannot be filled in automatically. " +
            "Upload the template as HTML, PNG or JPEG to generate certificates from it.");
    }

    /// <summary>
    /// What is printed when no template has been uploaded.
    ///
    /// A plain, correct certificate rather than an error: the award has been
    /// made and the record exists, and refusing to show anything would leave
    /// the holder with nothing while the artwork is sorted out.
    /// </summary>
    private static string Fallback(CertificateKind kind, IReadOnlyDictionary<string, string> values)
    {
        var heading = kind == CertificateKind.Qualification
            ? "Certificate of Achievement"
            : "Certificate of Participation";

        var wording = kind == CertificateKind.Qualification
            ? "has successfully completed and qualified in"
            : "has attended";

        return $"""
            <section class="page page--plain">
              <header class="plain__head">
                <div class="plain__org">{Escape(values.GetValueOrDefault("organisationName"))}</div>
                <h1 class="plain__title">{heading}</h1>
              </header>
              <div class="plain__body">
                <p class="plain__lead">This is to certify that</p>
                <p class="plain__name">{Escape(values.GetValueOrDefault("recipientName"))}</p>
                <p class="plain__lead">{wording}</p>
                <p class="plain__programme">{Escape(values.GetValueOrDefault("programTypeName"))}</p>
                <p class="plain__meta">
                  {Escape(values.GetValueOrDefault("programmeName"))}<br />
                  {Escape(values.GetValueOrDefault("startDate"))} to {Escape(values.GetValueOrDefault("endDate"))}
                  @ {Escape(values.GetValueOrDefault("city"))}
                </p>
              </div>
              <footer class="plain__foot">
                <div>
                  <div class="plain__label">Certificate number</div>
                  <div class="plain__value">{Escape(values.GetValueOrDefault("certificateNumber"))}</div>
                </div>
                <div>
                  <div class="plain__label">Issued</div>
                  <div class="plain__value">{Escape(values.GetValueOrDefault("issuedOn"))}</div>
                </div>
                <div>
                  <div class="plain__label">Valid till</div>
                  <div class="plain__value">{Escape(values.GetValueOrDefault("validTill", "—"))}</div>
                </div>
              </footer>
            </section>
            """;
    }

    private static readonly Regex Token = new(@"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", RegexOptions.Compiled);

    /// <summary>
    /// Substitutes the placeholders in a template.
    ///
    /// Values are HTML-escaped on the way in. A recipient's name is data, and a
    /// name containing a stray angle bracket must print as that name rather
    /// than disturb the surrounding markup.
    /// </summary>
    private static string Fill(string template, IReadOnlyDictionary<string, string> values) =>
        Token.Replace(template, match => Escape(values.GetValueOrDefault(match.Groups[1].Value, string.Empty)));

    private static string Escape(string? value) =>
        System.Net.WebUtility.HtmlEncode(value ?? string.Empty);

    private static string Describe(string contentType) => contentType.ToLowerInvariant() switch
    {
        var t when t.Contains("pdf") => "PDF",
        var t when t.Contains("wordprocessingml") => "Word",
        _ => contentType,
    };

    /* $$ raw string: the stylesheet is full of single braces, so interpolation
   uses {{ }} here and CSS braces pass through untouched. */
    private static string Document(string title, IReadOnlyList<string> pages) => $$"""
        <!doctype html>
        <html lang="en">
        <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{{Escape(title)}}</title>
        <style>
          /* Landscape A4 with no printer margins: the artwork is the page. */
          @page { size: A4 landscape; margin: 0; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #52525b;
            font-family: Georgia, 'Times New Roman', serif;
            color: #1c1a1a;
          }
          .page {
            position: relative;
            width: 297mm;
            height: 210mm;
            margin: 10mm auto;
            background: #fff;
            overflow: hidden;
            box-shadow: 0 2px 18px rgba(0, 0, 0, 0.35);
            page-break-after: always;
          }
          .page:last-child { page-break-after: auto; }
          .page--art { background-size: cover; background-position: center; }

          /* Text laid over an image template. Kept to the lower middle, which
             is where a certificate's name line sits on almost every design. */
          .overlay {
            position: absolute;
            left: 12%;
            right: 12%;
            top: 46%;
            text-align: center;
          }
          .overlay__name { font-size: 34pt; font-weight: 700; letter-spacing: 0.5pt; }
          .overlay__line { margin-top: 6mm; font-size: 14pt; }
          .overlay__foot {
            position: absolute;
            left: 0; right: 0; top: 46mm;
            display: flex; justify-content: space-between;
            font-size: 10pt; color: #3f3a3a;
          }

          /* The plain certificate, used when no artwork has been uploaded. */
          .page--plain { padding: 18mm 22mm; display: flex; flex-direction: column; }
          .page--plain::before {
            content: '';
            position: absolute; inset: 8mm;
            border: 2px solid #82232f;
            outline: 1px solid #c9971a;
            outline-offset: 3mm;
            pointer-events: none;
          }
          .plain__head { text-align: center; }
          .plain__org { font-size: 12pt; letter-spacing: 3pt; text-transform: uppercase; color: #82232f; }
          .plain__title { margin: 4mm 0 0; font-size: 28pt; font-weight: 400; letter-spacing: 1pt; }
          .plain__body { flex: 1; display: flex; flex-direction: column; justify-content: center; text-align: center; }
          .plain__lead { margin: 0; font-size: 12pt; color: #57514f; font-style: italic; }
          .plain__name {
            margin: 5mm 0; font-size: 30pt; font-weight: 700;
            border-bottom: 1px solid #ccc4c1; display: inline-block;
            align-self: center; padding: 0 12mm 3mm;
          }
          .plain__programme { margin: 4mm 0 0; font-size: 18pt; font-weight: 700; color: #82232f; }
          .plain__meta { margin: 4mm 0 0; font-size: 11pt; color: #57514f; line-height: 1.6; }
          .plain__foot { display: flex; justify-content: space-between; gap: 10mm; }
          .plain__label { font-size: 8pt; text-transform: uppercase; letter-spacing: 1pt; color: #7a716f; }
          .plain__value { font-size: 11pt; font-weight: 700; font-family: ui-monospace, monospace; }

          @media print {
            body { background: none; }
            .page { margin: 0; box-shadow: none; }
          }
        </style>
        </head>
        <body>
        {{string.Join("\n", pages)}}
        </body>
        </html>
        """;
}
