using System.Net;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>
/// The two pages a payment needs in a browser: the one that carries the payer
/// to the gateway, and the one the gateway sends them back to.
///
/// Anonymous, because neither can carry a token. The first is reached from
/// the phone's own browser, which has no session with this API; the second is
/// posted by the gateway's servers, which have no session with anybody. What
/// stands in for authentication is the order id, which is random and used
/// once, and the gateway's own encryption of the reply.
/// </summary>
[Route("api/payments")]
[AllowAnonymous]
public class PaymentsController(PaymentService payments) : ControllerBase
{
    private string PublicBaseUrl => $"{Request.Scheme}://{Request.Host}";

    /// <summary>
    /// Carries the payer to the gateway.
    ///
    /// A form that submits itself, because a gateway takes its instruction as
    /// a POST body. There is a button behind the script for anybody whose
    /// browser will not run it.
    /// </summary>
    [HttpGet("go/{orderId}")]
    public async Task<IActionResult> Go(string orderId, CancellationToken ct)
    {
        try
        {
            var redirect = await payments.RedirectAsync(orderId, PublicBaseUrl, ct);

            var inputs = new StringBuilder();
            foreach (var (name, value) in redirect.Fields)
            {
                inputs.Append(
                    $"""<input type="hidden" name="{Esc(name)}" value="{Esc(value)}" />""");
            }

            return Html(Page(
                title: "Taking you to the payment page",
                heading: "Taking you to the payment page",
                body: """
                      <p>Do not close this window. If nothing happens in a few
                      seconds, use the button below.</p>
                      """,
                extra: $"""
                        <form id="go" method="post" action="{Esc(redirect.PostUrl)}">
                          {inputs}
                          <button type="submit" class="btn">Continue to the gateway</button>
                        </form>
                        <script>document.getElementById('go').submit();</script>
                        """));
        }
        catch (AppException caught)
        {
            return Html(Page(
                title: "Payment",
                heading: "This payment cannot be opened",
                body: $"<p>{Esc(caught.Message)}</p>",
                tone: "bad"), caught.StatusCode);
        }
    }

    /// <summary>
    /// Where the gateway posts what happened.
    ///
    /// Answers with a page rather than an envelope: it is the payer's own
    /// browser that lands here, and what they need is to be told plainly and
    /// sent back to the app.
    /// </summary>
    [HttpPost("callback")]
    public async Task<IActionResult> Callback(CancellationToken ct)
    {
        var payload = Request.HasFormContentType
            ? Request.Form["encResp"].ToString()
            : string.Empty;

        if (string.IsNullOrWhiteSpace(payload))
        {
            return Html(Page(
                title: "Payment",
                heading: "Nothing came back from the gateway",
                body: """
                      <p>No result was received. If money has left your account
                      it will be reversed by your bank. Check the Payments
                      screen in the app before trying again.</p>
                      """,
                tone: "bad"));
        }

        PaymentTransactionDto result;
        try
        {
            result = await payments.CompleteAsync(payload, ct);
        }
        catch (AppException caught)
        {
            return Html(Page(
                title: "Payment",
                heading: "The reply could not be read",
                body: $"""
                       <p>{Esc(caught.Message)}</p>
                       <p>Nothing has been recorded against your application.
                       Check the Payments screen in the app before trying again.</p>
                       """,
                tone: "bad"));
        }

        var back = $"ntms:///payment/status/{Uri.EscapeDataString(result.OrderId)}";
        var button = $"""<a class="btn" href="{Esc(back)}">Return to the app</a>""";

        return result.Status switch
        {
            "Paid" => Html(Page(
                title: "Payment successful",
                heading: "Payment successful",
                body: $"""
                       <p class="amount">{Esc(Money(result))}</p>
                       <dl>
                         <dt>Application</dt><dd>{Esc(result.ApplicationNo)}</dd>
                         <dt>Reference</dt><dd>{Esc(result.TrackingId ?? result.OrderId)}</dd>
                         {(result.Method is null ? "" : $"<dt>Method</dt><dd>{Esc(result.Method)}</dd>")}
                       </dl>
                       <p>A receipt is on the Payments screen in the app.</p>
                       """,
                tone: "good",
                extra: button)),

            "Cancelled" => Html(Page(
                title: "Payment cancelled",
                heading: "Payment cancelled",
                body: """
                      <p>No money has been taken. Your application is unchanged
                      and the fee can be paid whenever you are ready.</p>
                      """,
                extra: button)),

            _ => Html(Page(
                title: "Payment failed",
                heading: "Payment failed",
                body: $"""
                       <p>{Esc(result.FailureReason ?? "The gateway did not complete the payment.")}</p>
                       <p>If your account was debited, banks reverse an
                       incomplete payment within a few working days.</p>
                       """,
                tone: "bad",
                extra: button)),
        };
    }

    /* ------------------------------------------------------------- pages */

    private ContentResult Html(string html, int status = 200) => new()
    {
        Content = html,
        ContentType = "text/html; charset=utf-8",
        StatusCode = status,
    };

    private static string Esc(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);

    private static string Money(PaymentTransactionDto result) =>
        $"{(result.Currency == "INR" ? "₹" : result.Currency + " ")}{result.Amount:N2}";

    /// <summary>
    /// One self-contained page. No stylesheet and no script from anywhere
    /// else: this is the last thing between a payer and their money, and it
    /// has to render the same whatever the network did to the rest.
    /// </summary>
    private static string Page(
        string title, string heading, string body, string tone = "plain", string extra = "") =>
        $$"""
          <!doctype html>
          <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>{{Esc(title)}}</title>
            <style>
              :root { --ink:#1c1a1a; --muted:#57514f; --line:#e6e0de; --brand:#82232f;
                      --good:#3d6b11; --bad:#b3300d; }
              * { box-sizing: border-box; }
              body { margin:0; min-height:100vh; display:flex; align-items:center;
                     justify-content:center; padding:24px;
                     background:#f8f5f4; color:var(--ink);
                     font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
              .card { width:100%; max-width:420px; background:#fff; border:1px solid var(--line);
                      border-radius:14px; padding:28px 24px; }
              h1 { margin:0 0 12px; font-size:21px; }
              h1.good { color:var(--good); }
              h1.bad { color:var(--bad); }
              p { margin:0 0 12px; color:var(--muted); }
              .amount { font-size:30px; font-weight:700; color:var(--ink); margin:4px 0 16px; }
              dl { margin:0 0 16px; display:grid; grid-template-columns:auto 1fr;
                   gap:6px 16px; font-size:14px; }
              dt { color:var(--muted); }
              dd { margin:0; font-weight:600; }
              .btn { display:block; width:100%; margin-top:8px; padding:13px 16px;
                     border:0; border-radius:10px; background:var(--brand); color:#fff;
                     font-size:16px; font-weight:600; text-align:center;
                     text-decoration:none; cursor:pointer; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1 class="{{tone}}">{{Esc(heading)}}</h1>
              {{body}}
              {{extra}}
            </div>
          </body>
          </html>
          """;
}
