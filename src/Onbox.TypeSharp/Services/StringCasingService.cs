using System.Globalization;

namespace Onbox.TypeSharp.Services
{
    public class StringCasingService
    {
        public string ConvertToCamelCase(string text)
        {
            if (string.IsNullOrEmpty(text) || !char.IsUpper(text[0]))
            {
                return text;
            }

            var chars = text.ToCharArray();

            for (var i = 0; i < chars.Length; i++)
            {
                if (i == 1 && !char.IsUpper(chars[i]))
                {
                    break;
                }

                var hasNext = i + 1 < chars.Length;
                if (i > 0 && hasNext && !char.IsUpper(chars[i + 1]))
                {
                    break;
                }

                chars[i] = char.ToLower(chars[i], CultureInfo.InvariantCulture);
            }

            return new string(chars);
        }
    }
}
