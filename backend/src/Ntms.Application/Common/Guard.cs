namespace Ntms.Application.Common;

/// <summary>
/// Small assertion helpers so every service rejects malformed input the same
/// way, with a message the client can show as-is.
/// </summary>
public static class Guard
{
    /// <summary>Collects several problems so the caller sees them all at once.</summary>
    public sealed class Collector
    {
        private readonly List<string> _errors = [];

        public Collector Required(string? value, string label)
        {
            if (string.IsNullOrWhiteSpace(value)) _errors.Add($"{label} is required.");
            return this;
        }

        /// <summary>
        /// For codes the system fills in when they are left blank. A value that
        /// is supplied still has to be well formed; an empty one is the caller
        /// saying "generate it", which is not an error.
        /// </summary>
        public Collector CodeIfPresent(string? value, string label = "Code")
        {
            var normalised = Formats.Normalise(value);
            if (!string.IsNullOrWhiteSpace(normalised) && !Formats.IsCode(normalised))
            {
                _errors.Add(
                    $"{label} may only contain capital letters, digits, dash or slash (2-20 characters).");
            }
            return this;
        }

        public Collector Code(string? value, string label = "Code")
        {
            var normalised = Formats.Normalise(value);
            if (string.IsNullOrWhiteSpace(normalised))
            {
                _errors.Add($"{label} is required.");
            }
            else if (!Formats.IsCode(normalised))
            {
                _errors.Add(
                    $"{label} may only contain capital letters, digits, dash or slash (2-20 characters).");
            }
            return this;
        }

        public Collector Email(string? value, bool required = true, string label = "Email")
        {
            if (required && string.IsNullOrWhiteSpace(value)) _errors.Add($"{label} is required.");
            else if (!Formats.IsEmail(value)) _errors.Add(FORMAT(label, "address"));
            return this;
        }

        public Collector Mobile(string? value, bool required = true, string label = "Mobile")
        {
            if (required && string.IsNullOrWhiteSpace(value)) _errors.Add($"{label} is required.");
            else if (!Formats.IsMobile(value))
                _errors.Add($"{label} must be 10 digits starting with 6-9.");
            return this;
        }

        public Collector Pan(string? value, bool required = false, string label = "PAN")
        {
            if (required && string.IsNullOrWhiteSpace(value)) _errors.Add($"{label} is required.");
            else if (!Formats.IsPan(Formats.Normalise(value))) _errors.Add(FORMAT(label, "number"));
            return this;
        }

        public Collector Gstin(string? value, string label = "GSTIN")
        {
            if (!Formats.IsGstin(Formats.Normalise(value))) _errors.Add(FORMAT(label, "number"));
            return this;
        }

        public Collector Tan(string? value, bool required = false, string label = "TAN")
        {
            if (required && string.IsNullOrWhiteSpace(value)) _errors.Add($"{label} is required.");
            else if (!Formats.IsTan(Formats.Normalise(value))) _errors.Add(FORMAT(label, "number"));
            return this;
        }

        public Collector Pincode(string? value, bool required = true, string label = "Pincode")
        {
            if (required && string.IsNullOrWhiteSpace(value)) _errors.Add($"{label} is required.");
            else if (!Formats.IsPincode(value)) _errors.Add($"{label} must be 6 digits and cannot start with 0.");
            return this;
        }

        public Collector Range(int value, int min, int max, string label)
        {
            if (value < min || value > max) _errors.Add($"{label} must be between {min} and {max}.");
            return this;
        }

        public Collector When(bool condition, string message)
        {
            if (condition) _errors.Add(message);
            return this;
        }

        /// <summary>Throws a single 400 carrying every problem found.</summary>
        public void ThrowIfInvalid()
        {
            if (_errors.Count > 0) throw new AppException(string.Join(" ", _errors));
        }

        private static string FORMAT(string label, string noun) => $"{label} {noun} is not valid.";
    }

    public static Collector Check() => new();
}
