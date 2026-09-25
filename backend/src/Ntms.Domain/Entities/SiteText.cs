using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// A piece of wording somebody has changed.
///
/// Only overrides are stored. The wording the product ships with lives in code,
/// in the registry beside the service, so an empty table means every screen
/// reads exactly as written and a new string can be added in a release without
/// a migration or a data fix. Restoring the original is deleting the row, not
/// copying the default back into it — which also means a later change to the
/// shipped wording reaches everybody who never overrode it.
/// </summary>
public class SiteText : AuditableEntity
{
    /// <summary>Matches a key in the registry. Unknown keys are ignored.</summary>
    public string Key { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;
}
