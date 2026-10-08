<?php
declare(strict_types=1);

namespace Kg;

/** Чистка пользовательских строк, транслитерация для адресов и формат времени для ответов API. */
final class Text
{
    /** Русские (и близкие украинские/белорусские) буквы → латиница для slug. */
    private const TRANSLIT = [
        'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd', 'е' => 'e', 'ё' => 'e', 'ж' => 'zh', 'з' => 'z',
        'и' => 'i', 'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n', 'о' => 'o', 'п' => 'p', 'р' => 'r',
        'с' => 's', 'т' => 't', 'у' => 'u', 'ф' => 'f', 'х' => 'kh', 'ц' => 'ts', 'ч' => 'ch', 'ш' => 'sh', 'щ' => 'shch',
        'ъ' => '', 'ы' => 'y', 'ь' => '', 'э' => 'e', 'ю' => 'yu', 'я' => 'ya',
        'і' => 'i', 'ї' => 'yi', 'є' => 'ye', 'ґ' => 'g', 'ў' => 'u',
    ];

    /**
     * Строка без управляющих символов и невидимых «разворотов» текста, с обрезанными краями.
     * Переводы строк и табуляции превращаются в пробел (иначе слова склеятся), остальные управляющие символы удаляются.
     */
    public static function clean(string $s): string
    {
        $s = preg_replace('/[\t\n\r\x{2028}\x{2029}]+/u', ' ', $s) ?? '';
        $s = preg_replace('/[\p{Cc}\x{200B}\x{FEFF}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $s) ?? '';
        return preg_replace('/^[\s\p{Z}]+|[\s\p{Z}]+$/u', '', $s) ?? '';
    }

    /** Адрес подборки из названия: латиница, цифры и дефисы; если ничего не осталось — «podborka». */
    public static function slug(string $title): string
    {
        $s = strtr(mb_strtolower($title), self::TRANSLIT);
        $s = trim((string) preg_replace('/[^a-z0-9]+/', '-', $s), '-');
        $s = rtrim(substr($s, 0, 100), '-');
        return $s === '' ? 'podborka' : $s;
    }

    /** Время из базы (UTC, "Y-m-d H:i:s") → ISO 8601 с буквой Z. */
    public static function iso(string $dt): string
    {
        return gmdate('Y-m-d\TH:i:s\Z', (int) strtotime($dt . ' UTC'));
    }
}
