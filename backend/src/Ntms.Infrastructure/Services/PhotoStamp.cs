using System.Globalization;
using Microsoft.Extensions.Logging;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Draws when and where a picture was taken into the picture itself.
///
/// The point is that the mark travels with the image. A position held in a
/// column beside the bytes is lost the moment anybody downloads the file,
/// mails it to a colleague or prints it for a file — which is exactly what
/// happens to evidence of a site visit. Burnt into the top-left corner it
/// survives all of that, and it is in the corner because the subject of
/// the photograph is in the middle.
///
/// Drawing is done once, as the picture arrives, rather than on the way
/// out. An unmarked original is then never served, and the cost is paid
/// on one upload instead of on every read.
///
/// GDI+ is Windows-only, which this deployment is. Every failure path ends
/// in the original bytes being returned unmarked: a picture is evidence and
/// a stamp is a convenience, so a stamp that cannot be drawn must never be
/// the reason a photograph is lost. The caller records whether it worked.
/// </summary>
public static class PhotoStamp
{
    /// <summary>The marked image, and whether marking it actually happened.</summary>
    public readonly record struct Result(byte[] Content, string ContentType, bool Stamped);

    /// <summary>
    /// Draws the capture time and position onto a photograph.
    /// </summary>
    /// <param name="content">The image as it arrived.</param>
    /// <param name="capturedOnUtc">When the shutter went, as the phone had it.</param>
    /// <param name="latitude">Where the phone thought it was, if it knew.</param>
    /// <param name="longitude">The other half of that, if it knew.</param>
    public static Result Apply(
        byte[] content,
        DateTime capturedOnUtc,
        decimal? latitude,
        decimal? longitude,
        ILogger? logger = null)
    {
        if (!OperatingSystem.IsWindows())
        {
            /* Not an error worth shouting about on a developer's machine,
               but it must not pass silently on a server either. */
            logger?.LogWarning(
                "Photographs are not being stamped: drawing is only supported on Windows.");
            return new Result(content, "image/jpeg", false);
        }

        try
        {
            return Draw(content, Lines(capturedOnUtc, latitude, longitude));
        }
        catch (Exception caught)
        {
            /* A frame the decoder will not read, an out-of-memory on a very
               large image, a GDI+ handle that could not be had. The
               photograph is kept either way. */
            logger?.LogWarning(caught,
                "A photograph could not be stamped. It has been stored unmarked.");
            return new Result(content, "image/jpeg", false);
        }
    }

    /// <summary>
    /// What the corner says: the time on the first line, the position on
    /// the second. Indian time, because that is where it was taken and the
    /// person reading it is in the same country.
    /// </summary>
    private static string[] Lines(DateTime capturedOnUtc, decimal? latitude, decimal? longitude)
    {
        var when = Email.IndianTime.Format(capturedOnUtc);

        var where = latitude is { } lat && longitude is { } lon
            ? string.Format(CultureInfo.InvariantCulture, "{0:0.000000}, {1:0.000000}", lat, lon)
            : "Location not recorded";

        return [when, where];
    }

    [System.Runtime.Versioning.SupportedOSPlatform("windows")]
    private static Result Draw(byte[] content, string[] lines)
    {
        using var source = new MemoryStream(content);
        using var image = System.Drawing.Image.FromStream(source);

        /* Onto a copy. An Image loaded from a stream keeps a hold on that
           stream, and drawing into it directly is undefined for several of
           the formats a phone might send. */
        using var canvas = new System.Drawing.Bitmap(image.Width, image.Height);
        canvas.SetResolution(image.HorizontalResolution, image.VerticalResolution);

        using (var gfx = System.Drawing.Graphics.FromImage(canvas))
        {
            gfx.DrawImage(image, 0, 0, image.Width, image.Height);
            Mark(gfx, image.Width, image.Height, lines);
        }

        using var output = new MemoryStream();
        /* JPEG whatever came in. These are photographs, the stamp has no
           transparency, and one format out means the portal and the apps
           have one thing to display. */
        canvas.Save(output, System.Drawing.Imaging.ImageFormat.Jpeg);
        return new Result(output.ToArray(), "image/jpeg", true);
    }

    [System.Runtime.Versioning.SupportedOSPlatform("windows")]
    private static void Mark(
        System.Drawing.Graphics gfx, int width, int height, string[] lines)
    {
        /* Sized to the picture, not to a fixed number of points. A phone
           sends anything from 480 to 4000 pixels across, and 12pt text is
           unreadable on one and lost on the other. Floored so a thumbnail
           is still legible and capped so a large frame is not defaced. */
        var size = Math.Clamp(Math.Min(width, height) / 32f, 11f, 42f);

        using var font = new System.Drawing.Font(
            "Segoe UI", size, System.Drawing.FontStyle.Bold,
            System.Drawing.GraphicsUnit.Pixel);

        gfx.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;

        var pad = size * 0.5f;
        var measured = lines
            .Select(line => gfx.MeasureString(line, font))
            .ToArray();

        var boxWidth = measured.Max(m => m.Width) + pad * 2;
        var boxHeight = measured.Sum(m => m.Height) + pad * 2;

        /* A dark panel behind the text. White on white is the usual way a
           stamp like this becomes invisible, and a photograph of a
           certificate is mostly white paper. */
        using var panel = new System.Drawing.SolidBrush(
            System.Drawing.Color.FromArgb(150, 0, 0, 0));
        gfx.FillRectangle(panel, 0, 0, boxWidth, boxHeight);

        using var ink = new System.Drawing.SolidBrush(System.Drawing.Color.White);
        var y = pad;
        for (var i = 0; i < lines.Length; i++)
        {
            gfx.DrawString(lines[i], font, ink, pad, y);
            y += measured[i].Height;
        }
    }
}
