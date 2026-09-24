using Ntms.Domain.Common;

namespace Ntms.Application.Common;

/// <summary>
/// What each certification policy means, in one place.
///
/// Screens need the wording, the API needs to know which templates a programme
/// may hold, and the awarding step needs to know what a given result earns.
/// Deriving all three from the same table keeps them from drifting — a
/// programme that offers no participation certificate must not be able to have
/// one uploaded, and a policy shown as "no certificate" must not quietly award
/// one.
/// </summary>
public static class CertificationPolicies
{
    public static string Label(CertificationPolicy policy) => policy switch
    {
        CertificationPolicy.None => "No certificate",
        CertificationPolicy.ParticipationOnly => "Participation certificate only",
        CertificationPolicy.QualificationOnly => "Certification for those who qualify",
        CertificationPolicy.QualificationAndParticipation =>
            "Certification for those who qualify, participation for the rest",
        _ => policy.ToString(),
    };

    /// <summary>The certificate kinds this policy can award.</summary>
    public static IReadOnlyList<CertificateKind> KindsFor(CertificationPolicy policy) => policy switch
    {
        CertificationPolicy.None => [],
        CertificationPolicy.ParticipationOnly => [CertificateKind.Participation],
        CertificationPolicy.QualificationOnly => [CertificateKind.Qualification],
        CertificationPolicy.QualificationAndParticipation =>
            [CertificateKind.Qualification, CertificateKind.Participation],
        _ => [],
    };

    public static bool Awards(CertificationPolicy policy, CertificateKind kind) =>
        KindsFor(policy).Contains(kind);

    /// <summary>
    /// What one candidate earns, given the policy and whether they qualified.
    /// Null means nothing is awarded.
    /// </summary>
    public static CertificateKind? AwardFor(CertificationPolicy policy, bool qualified) => policy switch
    {
        CertificationPolicy.None => null,
        CertificationPolicy.ParticipationOnly => CertificateKind.Participation,
        CertificationPolicy.QualificationOnly =>
            qualified ? CertificateKind.Qualification : null,
        CertificationPolicy.QualificationAndParticipation =>
            qualified ? CertificateKind.Qualification : CertificateKind.Participation,
        _ => null,
    };
}
