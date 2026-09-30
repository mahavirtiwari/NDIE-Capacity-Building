using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Everybody the scheme has qualified, across every programme.
///
/// The certificate list is per programme, which answers "who did this batch
/// certify" and not "who is qualified to do this work" — and the second is the
/// question the scheme exists to answer. A registry the Ministry can search by
/// state, by programme type, and by whether the qualification still stands is
/// the thing that makes the training countable.
///
/// A row is a participant who passed, not a certificate. Passing is the
/// qualification; the certificate is the evidence of it, and one can exist for
/// a while without the other — the result is recorded when the marks are in
/// and the certificate is issued afterwards. Listing only the certified would
/// hide everyone in that gap, so <see cref="QualifiedProfessionalDto.Standing"/>
/// carries the difference instead.
///
/// Read only. Nothing here issues, revokes or restates anything.
/// </summary>
public class QualifiedProfessionalService(NtmsDbContext db, ICurrentUser currentUser)
{
    /// <summary>How near expiry counts as expiring, for the standing filter.</summary>
    private const int ExpiringWithinDays = 90;

    public async Task<PagedResult<QualifiedProfessionalDto>> ListAsync(
        PagedRequest request,
        int? categoryId,
        int? subCategoryId,
        int? programTypeId,
        int? stateCode,
        string? standing,
        DateTime? qualifiedFrom,
        DateTime? qualifiedTo,
        CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        /* Scoped through the programme, which is where category, program type
           and state live — the same rule every other estate-wide list uses, so
           an Operation Manager sees their allocation here and nothing else. */
        var scoped = db.Programmes.AsNoTracking().WithinScope(currentUser).Select(p => p.Id);

        var query =
            from participant in db.ProgrammeParticipants.AsNoTracking()
            where participant.Result == ParticipantResult.Pass
                  && scoped.Contains(participant.ProgrammeId)
            join certificate in db.Certificates.AsNoTracking()
                on participant.Id equals certificate.ParticipantId into issued
            from certificate in issued
                .OrderByDescending(c => c.RevokedOn == null)
                .ThenByDescending(c => c.IssuedOn)
                .Take(1)
                .DefaultIfEmpty()
            select new { participant, certificate };

        query = query
            .WhereIf(categoryId.HasValue, x => x.participant.Programme!.CategoryId == categoryId)
            .WhereIf(subCategoryId.HasValue, x => x.participant.Programme!.SubCategoryId == subCategoryId)
            .WhereIf(programTypeId.HasValue, x => x.participant.Programme!.ProgramTypeId == programTypeId)
            .WhereIf(stateCode.HasValue, x => x.participant.Programme!.StateCode == stateCode)
            /* When they qualified, which is when the marks added up to a
               pass - not when a certificate was printed, which may be days
               later or not at all. */
            .WhereIf(qualifiedFrom.HasValue,
                x => x.participant.ResultRecordedOn >= qualifiedFrom!.Value)
            .WhereIf(qualifiedTo.HasValue,
                x => x.participant.ResultRecordedOn < qualifiedTo!.Value.Date.AddDays(1));

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim();
            query = query.Where(x =>
                x.participant.Applicant!.FullName.Contains(search)
                || x.participant.Applicant!.ApplicantCode.Contains(search)
                || x.participant.Applicant!.Mobile.Contains(search)
                || (x.certificate != null && x.certificate.Number.Contains(search)));
        }

        /* Filtered in the database rather than after paging: a page of twenty
           that turns into four once the expired are dropped is not a page. */
        query = standing switch
        {
            "Valid" => query.Where(x => x.certificate != null && x.certificate.RevokedOn == null
                                        && (x.certificate.ValidTill == null || x.certificate.ValidTill >= today)),
            "Expiring" => query.Where(x => x.certificate != null && x.certificate.RevokedOn == null
                                           && x.certificate.ValidTill != null
                                           && x.certificate.ValidTill >= today
                                           && x.certificate.ValidTill < today.AddDays(ExpiringWithinDays)),
            "Expired" => query.Where(x => x.certificate != null && x.certificate.RevokedOn == null
                                          && x.certificate.ValidTill != null && x.certificate.ValidTill < today),
            "Revoked" => query.Where(x => x.certificate != null && x.certificate.RevokedOn != null),
            "NotIssued" => query.Where(x => x.certificate == null),
            _ => query,
        };

        query = (request.SortBy?.ToLowerInvariant()) switch
        {
            "name" => Direction(query, x => x.participant.Applicant!.FullName, request),
            "programtype" => Direction(query, x => x.participant.Programme!.ProgramType!.Name, request),
            "state" => Direction(query, x => x.participant.Programme!.State!.Name, request),
            "validtill" => Direction(query, x => x.certificate!.ValidTill, request),
            /* Newest qualification first: the useful default for a register
               that only ever grows. */
            _ => request.SortDir == "asc"
                ? query.OrderBy(x => x.participant.ResultRecordedOn).ThenBy(x => x.participant.Id)
                : query.OrderByDescending(x => x.participant.ResultRecordedOn).ThenByDescending(x => x.participant.Id),
        };

        var total = await query.CountAsync(ct);
        var page = Math.Max(1, request.Page);
        var size = Math.Clamp(request.PageSize, 1, 200);

        /* Projected field by field rather than as entities. A projection that
           selects the Programme loads the Programme and none of the things
           hanging off it, so every name on the row would come back null. */
        var rows = await query
            .Skip((page - 1) * size)
            .Take(size)
            .Select(x => new QualifiedProfessionalDto
            {
                ParticipantId = x.participant.Id,
                ApplicantId = x.participant.ApplicantId,
                ApplicantCode = x.participant.Applicant!.ApplicantCode,
                FullName = x.participant.Applicant!.FullName,
                Email = x.participant.Applicant!.Email,
                Mobile = x.participant.Applicant!.Mobile,

                CategoryId = x.participant.Programme!.CategoryId,
                CategoryName = x.participant.Programme!.Category!.Name,
                SubCategoryId = x.participant.Programme!.SubCategoryId,
                SubCategoryName = x.participant.Programme!.SubCategory!.Name,
                ProgramTypeId = x.participant.Programme!.ProgramTypeId,
                ProgramTypeName = x.participant.Programme!.ProgramType!.Name,

                ProgrammeId = x.participant.ProgrammeId,
                ProgrammeCode = x.participant.Programme!.ProgrammeId,
                ProgrammeName = x.participant.Programme!.ProgrammeName,

                StateCode = x.participant.Programme!.StateCode,
                StateName = x.participant.Programme!.State!.Name,
                DistrictCode = x.participant.Programme!.DistrictCode,
                DistrictName = x.participant.Programme!.District!.Name,

                ExamScore = x.participant.ExamScore,
                AttendancePercent = x.participant.AttendancePercent,
                QualifiedOn = x.participant.ResultRecordedOn,

                CertificateId = x.certificate == null ? null : x.certificate.Id,
                CertificateKind = x.certificate == null ? null : x.certificate.Kind.ToString(),
                CertificateNumber = x.certificate == null ? null : x.certificate.Number,
                IssuedOn = x.certificate == null ? null : x.certificate.IssuedOn,
                ValidTill = x.certificate == null ? null : x.certificate.ValidTill,
                RevokedOn = x.certificate == null ? null : x.certificate.RevokedOn,
            })
            .ToListAsync(ct);

        /* Standing is an answer about today, so it is settled here rather than
           stored or asked of the database. */
        foreach (var row in rows)
        {
            row.Standing = Standing(row, today);
            row.DaysToExpiry = row.ValidTill is { } till ? till.DayNumber - today.DayNumber : null;
        }

        return new PagedResult<QualifiedProfessionalDto>
        {
            Items = rows,
            Total = total,
            Page = page,
            PageSize = size,
        };
    }

    private static IQueryable<T> Direction<T, TKey>(
        IQueryable<T> query, System.Linq.Expressions.Expression<Func<T, TKey>> key, PagedRequest request) =>
        request.SortDir == "desc" ? query.OrderByDescending(key) : query.OrderBy(key);

    private static string Standing(QualifiedProfessionalDto row, DateOnly today)
    {
        if (row.CertificateNumber is null) return "NotIssued";
        if (row.RevokedOn is not null) return "Revoked";
        if (row.ValidTill is not { } till) return "Valid";
        if (till < today) return "Expired";
        return till < today.AddDays(ExpiringWithinDays) ? "Expiring" : "Valid";
    }
}
