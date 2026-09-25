namespace Ntms.Application.Contracts;

/*
  The trainer's marksheet for one programme: the candidates, the skills the
  viva is marked against, and what each of them was given.

  Shared by the portal and the coordinator's app, which show the same sheet on
  different sized screens. The scheme comes down with it so both can label the
  columns and check a mark before sending it, rather than each keeping its own
  copy of what the programme type says.
*/

/// <summary>Everything needed to open the sheet and fill it in.</summary>
public class MarksheetDto
{
    public int ProgrammeId { get; set; }
    public string ProgrammeCode { get; set; } = string.Empty;
    public string ProgrammeName { get; set; } = string.Empty;
    public string ProgramTypeName { get; set; } = string.Empty;

    /// <summary>What is examined, out of how many marks, and what passes.</summary>
    public EvaluationSchemeDto Evaluation { get; set; } = new();

    /// <summary>The skills the viva is marked against, in marking order.</summary>
    public List<MarksheetSkillDto> Skills { get; set; } = [];

    /// <summary>
    /// The trainers registered on this programme, so a mark can be attributed
    /// to whoever gave it. Empty when none has been registered yet.
    /// </summary>
    public List<MarksheetTrainerDto> Trainers { get; set; } = [];

    public List<MarksheetRowDto> Rows { get; set; } = [];

    /// <summary>
    /// Whether this account may change the sheet. False still shows it: a
    /// marksheet is worth reading by more people than may write it.
    /// </summary>
    public bool CanEdit { get; set; }

    /// <summary>Why not, when it cannot be edited.</summary>
    public string? ReadOnlyReason { get; set; }

    public int MarkedCount { get; set; }
    public int PassCount { get; set; }
    public int FailCount { get; set; }
}

public class MarksheetSkillDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MaxMarks { get; set; }
    public int DisplayOrder { get; set; }

    /// <summary>
    /// True for a retired skill that still carries marks on this sheet.
    ///
    /// It stays on the sheet, because the marks already given against it are
    /// part of the result, but nothing new can be marked against it.
    /// </summary>
    public bool IsRetired { get; set; }
}

public class MarksheetTrainerDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? Organisation { get; set; }
}

/// <summary>One candidate's line.</summary>
public class MarksheetRowDto
{
    public int ParticipantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ApplicationNo { get; set; } = string.Empty;
    public decimal AttendancePercent { get; set; }

    public decimal? WrittenMarks { get; set; }
    public decimal? VivaMarks { get; set; }
    public decimal? Total { get; set; }

    public string Result { get; set; } = "Pending";
    public DateTime? ResultRecordedOn { get; set; }

    /// <summary>What is still unmarked, when the result is pending.</summary>
    public string? Pending { get; set; }
    /// <summary>Which bar was missed, when the candidate did not qualify.</summary>
    public string? Shortfall { get; set; }

    /// <summary>
    /// True once a certificate has been issued against this result. The line
    /// is then read only: a mark behind a certificate that is already in
    /// somebody's hands cannot be quietly changed.
    /// </summary>
    public bool IsLocked { get; set; }

    public List<MarksheetSkillMarkDto> SkillMarks { get; set; } = [];
}

public class MarksheetSkillMarkDto
{
    public int SkillId { get; set; }
    public decimal Marks { get; set; }
    public int? TrainerId { get; set; }
    public string? TrainerName { get; set; }
    public DateTime MarkedOn { get; set; }
}

/* ------------------------------------------------------------------ saving */

/// <summary>
/// A pass of the sheet, sent as one list.
///
/// Marking is done down a row of candidates, often in a hall with no signal,
/// so the whole pass lands together or not at all. Only the rows that were
/// touched need be sent.
/// </summary>
public class MarksheetSaveDto
{
    public List<MarksheetRowSaveDto> Rows { get; set; } = [];
}

public class MarksheetRowSaveDto
{
    public int ParticipantId { get; set; }

    /// <summary>
    /// The written paper. Null leaves whatever is recorded alone, so a sheet
    /// sent from the viva screen cannot wipe a written mark it never showed.
    /// </summary>
    public decimal? WrittenMarks { get; set; }

    /// <summary>
    /// Only the skills that were marked. A skill left out keeps its mark; to
    /// take one back, send it with <see cref="MarksheetSkillMarkSaveDto.Clear"/>.
    /// </summary>
    public List<MarksheetSkillMarkSaveDto> SkillMarks { get; set; } = [];

    /// <summary>Who marked this candidate, when the app knows.</summary>
    public int? TrainerId { get; set; }
}

public class MarksheetSkillMarkSaveDto
{
    public int SkillId { get; set; }
    public decimal Marks { get; set; }
    /// <summary>Removes the mark instead of setting it.</summary>
    public bool Clear { get; set; }
}
