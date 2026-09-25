using Ntms.Domain.Common;

namespace Ntms.Application.Common;

/// <summary>
/// Reader-facing wording for what a programme type examines.
///
/// Kept beside the policy labels rather than in each client, so the phrase a
/// coordinator reads on the portal is the phrase a trainer reads in the app.
/// </summary>
public static class ExaminationKinds
{
    public static string Label(ExaminationKind kind) => kind switch
    {
        ExaminationKind.None => "No examination",
        ExaminationKind.Written => "Written examination",
        ExaminationKind.VivaPractical => "Viva / practical only",
        ExaminationKind.WrittenAndViva => "Written and viva / practical",
        _ => kind.ToString(),
    };
}
