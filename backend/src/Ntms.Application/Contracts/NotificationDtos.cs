namespace Ntms.Application.Contracts;

/// <summary>A handset saying hello, with the token the push service knows it by.</summary>
public class PushDeviceDto
{
    public string Token { get; set; } = string.Empty;
    /// <summary>android, ios or web.</summary>
    public string Platform { get; set; } = "android";
    /// <summary>applicant or coordinator.</summary>
    public string App { get; set; } = "applicant";
}

public class NotificationDto : AuditDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Audience { get; set; } = "Everyone";
    public string AudienceLabel { get; set; } = string.Empty;
    public int? SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }
    public int? StateCode { get; set; }
    public string? State { get; set; }
    public string? LinkPath { get; set; }
    public string Kind { get; set; } = "Custom";
    public string Status { get; set; } = "Draft";
    public DateTime? SentOn { get; set; }
    public int Handsets { get; set; }
    public int Delivered { get; set; }
    public int Failed { get; set; }
    public string? Note { get; set; }
}

public class NotificationUpsertDto
{
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Audience { get; set; } = "Everyone";
    public int? SubCategoryId { get; set; }
    public int? StateCode { get; set; }
    public string? LinkPath { get; set; }
    /// <summary>Compose and send in one go, which is what the button does.</summary>
    public bool SendNow { get; set; } = true;
}

/// <summary>One notification as the person reading it on a handset sees it.</summary>
public class MyNotificationDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? LinkPath { get; set; }
    public string Kind { get; set; } = "Custom";
    public DateTime SentOn { get; set; }
    public bool IsRead { get; set; }
}

public class MyNotificationsDto
{
    public List<MyNotificationDto> Items { get; set; } = [];
    public int Unread { get; set; }
}
