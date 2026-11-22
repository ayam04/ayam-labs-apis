/**
 * Stopword lists for the twelve languages this API supports.
 *
 * They serve two purposes:
 *  1. keyword extraction drops terms that are function words in any supported
 *     language (a small amount of cross-language overlap is accepted),
 *  2. language detection scores a text by how many of its tokens are stopwords
 *     in each language.
 *
 * The lists are curated by hand, written with their native diacritics.
 * Accent-insensitive matching happens in the lookup helpers below.
 */

export interface StopwordLanguage {
  /** ISO 639-1 language code. */
  code: string;
  /** English name of the language. */
  name: string;
  /** Curated stopword list (may contain duplicates, they are removed on load). */
  words: readonly string[];
}

/** Folds accents so "más" and "mas" compare equal. */
export function foldAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036F]/g, "");
}

export const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  sv: "Swedish",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  zh: "Chinese",
};

export const STOPWORD_LANGUAGES: readonly StopwordLanguage[] = [
  {
    code: "en",
    name: "English",
    words: [
      "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
      "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can",
      "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
      "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't",
      "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into",
      "is", "isn't", "it", "its", "itself", "just", "me", "more", "most", "mustn't", "my", "myself", "no", "nor",
      "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over",
      "own", "same", "shan't", "she", "should", "shouldn't", "so", "some", "such", "than", "that", "the", "their",
      "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too",
      "under", "until", "up", "very", "was", "wasn't", "we", "were", "weren't", "what", "when", "where", "which",
      "while", "who", "whom", "why", "will", "with", "won't", "would", "wouldn't", "you", "your", "yours",
      "yourself", "yourselves", "also", "may", "might", "must", "shall", "us", "upon", "within", "without", "yet",
    ],
  },
  {
    code: "es",
    name: "Spanish",
    words: [
      "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a", "en", "y", "o", "u", "que",
      "con", "por", "para", "sin", "sobre", "entre", "desde", "hasta", "cuando", "como", "dónde", "quién", "es",
      "son", "era", "eran", "fue", "fueron", "ser", "estar", "está", "están", "estoy", "estamos", "he", "has",
      "ha", "han", "hay", "muy", "más", "menos", "también", "pero", "sino", "aunque", "si", "no", "ni", "se",
      "su", "sus", "le", "les", "lo", "me", "te", "nos", "os", "yo", "tú", "usted", "nosotros", "ellos", "ellas",
      "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas", "mi", "mis", "nuestro", "nuestra", "ya",
      "todavía", "tan", "tanto", "todo", "toda", "todos", "todas", "otro", "otra", "hacer", "tener", "tiene",
      "tienen", "puede", "pueden", "porque", "pues", "entonces", "así", "ahora", "después", "antes", "durante",
      "contra", "cada", "cuál", "cuáles", "mismo", "misma", "será", "serán", "sido", "siendo", "van", "va",
    ],
  },
  {
    code: "fr",
    name: "French",
    words: [
      "le", "la", "les", "un", "une", "des", "du", "de", "au", "aux", "à", "et", "ou", "mais", "donc", "or",
      "ni", "car", "que", "qui", "quoi", "dont", "où", "quand", "comment", "pourquoi", "si", "ne", "pas", "plus",
      "moins", "très", "trop", "bien", "mal", "tout", "tous", "toute", "toutes", "autre", "autres", "même",
      "aussi", "encore", "déjà", "toujours", "jamais", "souvent", "parfois", "avec", "sans", "sous", "sur",
      "dans", "entre", "vers", "chez", "pour", "par", "depuis", "pendant", "avant", "après", "ce", "cet",
      "cette", "ces", "son", "sa", "ses", "mon", "ma", "mes", "ton", "ta", "tes", "notre", "nos", "votre", "vos",
      "leur", "leurs", "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "être", "est", "sont",
      "était", "étaient", "été", "avoir", "ai", "as", "ont", "avait", "avaient", "eu", "faire", "fait", "font",
      "peut", "peuvent", "dois", "doit", "comme", "y", "en", "lui", "se", "me", "te", "moi", "toi", "eux",
      "plusieurs", "chaque",
    ],
  },
  {
    code: "de",
    name: "German",
    words: [
      "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines", "und", "oder",
      "aber", "denn", "sondern", "doch", "wenn", "weil", "dass", "ob", "als", "wie", "wo", "wann", "warum",
      "wer", "was", "dieser", "diese", "dieses", "diesen", "diesem", "jede", "jeder", "jedes", "alle", "allen",
      "viel", "viele", "mehr", "weniger", "sehr", "auch", "noch", "schon", "immer", "nie", "nicht", "kein",
      "keine", "keinen", "mit", "ohne", "unter", "über", "auf", "aus", "bei", "nach", "von", "vom", "zu", "zum",
      "zur", "für", "gegen", "um", "an", "in", "im", "ist", "sind", "war", "waren", "gewesen", "sein", "haben",
      "hat", "hatte", "hatten", "habe", "hast", "wird", "werden", "wurde", "wurden", "kann", "können", "könnte",
      "muss", "müssen", "soll", "sollen", "will", "wollen", "ich", "du", "er", "sie", "es", "wir", "ihr", "mich",
      "mir", "dich", "dir", "sich", "uns", "euch", "mein", "meine", "dein", "deine", "seine", "ihre", "unser",
      "so", "dann", "dort", "hier", "jetzt", "heute", "durch", "zwischen",
    ],
  },
  {
    code: "it",
    name: "Italian",
    words: [
      "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "di", "del", "della", "dei", "degli", "delle", "a",
      "al", "alla", "ai", "agli", "alle", "da", "dal", "dalla", "in", "nel", "nella", "con", "su", "sul", "per",
      "tra", "fra", "e", "ed", "o", "od", "ma", "però", "perché", "che", "chi", "cui", "quale", "quali", "quando",
      "come", "dove", "se", "non", "né", "più", "meno", "molto", "poco", "troppo", "anche", "ancora", "già",
      "sempre", "mai", "spesso", "tutto", "tutti", "tutta", "tutte", "altro", "altra", "altri", "altre", "stesso",
      "stessa", "essere", "è", "sono", "era", "erano", "stato", "stata", "avere", "ha", "hanno", "ho", "hai",
      "aveva", "fare", "fa", "fanno", "può", "possono", "deve", "devono", "questo", "questa", "questi", "queste",
      "quello", "quella", "quelli", "quelle", "mio", "mia", "tuo", "tua", "suo", "sua", "nostro", "nostra",
      "loro", "io", "tu", "lui", "lei", "noi", "voi", "ci", "vi", "si", "mi", "ti", "ne", "senza", "sotto",
      "perciò", "quindi", "cioè",
    ],
  },
  {
    code: "pt",
    name: "Portuguese",
    words: [
      "o", "a", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das", "em", "no", "na", "nos",
      "nas", "por", "pelo", "pela", "para", "com", "sem", "sobre", "entre", "desde", "até", "e", "ou", "mas",
      "porém", "porque", "que", "quem", "qual", "quais", "quando", "como", "onde", "se", "não", "nem", "mais",
      "menos", "muito", "pouco", "também", "ainda", "já", "sempre", "nunca", "vezes", "todo", "toda", "todos",
      "todas", "outro", "outra", "outros", "outras", "mesmo", "mesma", "ser", "é", "são", "era", "eram", "foi",
      "foram", "estar", "está", "estão", "estou", "tem", "têm", "tinha", "havia", "haver", "ter", "fazer", "faz",
      "pode", "podem", "deve", "devem", "este", "esta", "estes", "estas", "esse", "essa", "esses", "essas",
      "aquele", "aquela", "eu", "tu", "ele", "ela", "nós", "vós", "eles", "elas", "me", "te", "lhe", "lhes",
      "meu", "minha", "teu", "tua", "seu", "sua", "nosso", "nossa", "isso", "isto", "aquilo", "aqui", "ali",
      "então", "assim", "bem", "mal", "hoje", "depois", "antes", "durante", "contra", "cada", "você", "vocês",
    ],
  },
  {
    code: "nl",
    name: "Dutch",
    words: [
      "de", "het", "een", "en", "of", "maar", "want", "dus", "dat", "die", "dit", "deze", "er", "is", "zijn",
      "was", "waren", "geweest", "worden", "wordt", "werd", "werden", "heeft", "hebben", "had", "hadden", "kan",
      "kunnen", "kon", "moet", "moeten", "zal", "zullen", "wil", "willen", "ik", "jij", "je", "hij", "zij", "ze",
      "wij", "we", "jullie", "u", "mij", "me", "mijn", "jouw", "zijn", "haar", "ons", "onze", "hun", "niet",
      "geen", "niets", "wel", "ook", "nog", "al", "altijd", "nooit", "soms", "vaak", "heel", "zeer", "meer",
      "minder", "veel", "weinig", "alles", "iets", "niemand", "iemand", "van", "voor", "met", "zonder", "onder",
      "over", "op", "in", "uit", "bij", "naar", "door", "tegen", "tussen", "na", "tijdens", "als", "toen", "hoe",
      "waar", "waarom", "wie", "wat", "welke", "omdat", "terwijl", "hier", "daar", "nu", "dan", "toch", "even",
    ],
  },
  {
    code: "sv",
    name: "Swedish",
    words: [
      "och", "i", "att", "det", "som", "en", "på", "är", "av", "för", "med", "till", "den", "har", "de", "inte",
      "om", "ett", "han", "men", "var", "jag", "sig", "från", "vi", "så", "kan", "man", "när", "år", "säger",
      "hon", "under", "också", "efter", "eller", "nu", "sin", "där", "vid", "mot", "ska", "skulle", "kommer",
      "ut", "får", "upp", "ha", "haft", "blir", "blev", "vara", "varit", "mycket", "mer", "mest", "mindre",
      "detta", "dessa", "denna", "vår", "vårt", "våra", "deras", "hans", "hennes", "sitt", "sina", "alla", "allt",
      "något", "inget", "ingen", "andra", "annat", "samma", "här", "dit", "då", "sedan", "innan", "medan",
      "eftersom", "fast", "även", "bara", "ju", "väl", "nog", "hade", "skall", "kunna", "finns", "blivit",
    ],
  },
  {
    code: "ru",
    name: "Russian",
    words: [
      "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все", "она", "так", "его",
      "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "только", "ее", "мне", "было", "вот", "от",
      "меня", "еще", "нет", "о", "из", "ему", "теперь", "когда", "даже", "ну", "вдруг", "ли", "если", "уже",
      "или", "ни", "быть", "был", "него", "до", "вас", "нибудь", "опять", "уж", "вам", "ведь", "там", "потом",
      "себя", "ничего", "ей", "может", "они", "тут", "где", "есть", "надо", "ней", "для", "мы", "тебя", "их",
      "чем", "была", "сам", "чтоб", "без", "будто", "чего", "раз", "тоже", "себе", "под", "будет", "ж", "тогда",
      "кто", "этот", "того", "потому", "этого", "какой", "совсем", "ним", "здесь", "этом", "один", "почти",
      "мой", "тем", "чтобы", "нее", "сейчас", "были", "куда", "зачем", "всех", "никогда", "можно", "при",
      "наконец", "два", "об", "другой", "хоть", "после", "над", "больше", "тот", "через", "эти", "нас", "про",
      "всего", "них", "какая", "много", "разве", "три", "эту", "моя", "впрочем", "хорошо", "свою", "этой",
      "перед", "иногда", "лучше", "чуть", "том", "нельзя", "такой", "им", "более", "всегда", "конечно", "всю",
      "между", "также", "этих", "который", "которая", "которые",
    ],
  },
  {
    code: "ar",
    name: "Arabic",
    words: [
      "في", "من", "على", "إلى", "الى", "عن", "مع", "هذا", "هذه", "ذلك", "تلك", "الذين", "التي", "الذي", "ما",
      "لا", "لم", "لن", "إن", "ان", "أن", "كان", "كانت", "يكون", "هو", "هي", "هم", "هن", "نحن", "أنا", "انت",
      "أنت", "وقد", "قد", "كل", "بعض", "غير", "بين", "عند", "حتى", "أو", "او", "ثم", "لكن", "بل", "كما",
      "إذا", "اذا", "لأن", "لان", "بسبب", "حول", "خلال", "بعد", "قبل", "دون", "فوق", "تحت", "أي", "اي",
      "أيضا", "ايضا", "هناك", "هنا", "الآن", "الان", "اليوم", "جدا", "أكثر", "اكثر", "أقل", "اقل", "كثيرا",
      "شيء", "أشياء", "كانوا", "ليس", "ليست", "عليه", "عليها", "فيه", "فيها", "له", "لها", "بهم", "لهم",
    ],
  },
  {
    code: "hi",
    name: "Hindi",
    words: [
      "है", "हैं", "का", "के", "की", "को", "में", "से", "और", "या", "पर", "तो", "भी", "नहीं", "न", "कि",
      "यह", "वह", "ये", "वे", "इस", "उस", "इन", "उन", "क्या", "कौन", "कब", "कहाँ", "क्यों", "कैसे", "जो",
      "जब", "तब", "अब", "यहाँ", "वहाँ", "साथ", "लिए", "बिना", "बाद", "पहले", "ऊपर", "नीचे", "बहुत", "थोड़ा",
      "अधिक", "कम", "सब", "कुछ", "कोई", "हम", "आप", "मैं", "तुम", "अपना", "अपनी", "अपने", "हो", "होता",
      "होती", "होते", "था", "थी", "थे", "गया", "गई", "गए", "कर", "करना", "किया", "रहा", "रही", "रहे", "दिया",
      "लेकिन", "इसलिए", "क्योंकि", "जैसे", "वैसे", "तक", "केवल", "फिर", "ही",
    ],
  },
  {
    code: "zh",
    name: "Chinese",
    words: [
      "的", "了", "和", "是", "就", "都", "而", "及", "与", "或", "一个", "没有", "我们", "你们", "他们",
      "她们", "它们", "这", "那", "这个", "那个", "这些", "那些", "我", "你", "他", "她", "它", "在", "有",
      "也", "不", "人", "上", "中", "下", "要", "会", "到", "说", "对", "为", "以", "于", "从", "被", "把",
      "给", "让", "使", "但", "但是", "因为", "所以", "如果", "可以", "可能", "已经", "还", "又", "很", "更",
      "最", "非常", "一些", "什么", "怎么", "为什么", "哪里", "时候", "现在", "今天", "明天", "昨天", "自己",
      "其", "之", "者", "并", "等", "着", "过", "地", "得", "里", "后", "前", "时", "年", "月", "日",
    ],
  },
];

/** Deduplicated stopword lists keyed by language code. */
export const STOPWORDS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(STOPWORD_LANGUAGES.map((language) => [language.code, Object.freeze([...new Set(language.words)])])),
);

/**
 * Union of every supported stopword list, in both accented and folded form.
 * A keyword candidate is dropped when it appears here.
 */
export const ALL_STOPWORDS: ReadonlySet<string> = new Set(
  Object.values(STOPWORDS).flatMap((words) => (words as string[]).flatMap((word) => [word, foldAccents(word)])),
);

export function getStopwords(code: string): readonly string[] | null {
  return STOPWORDS[code.toLowerCase()] ?? null;
}

/** True when the token is a function word in any supported language. */
export function isStopword(token: string): boolean {
  if (ALL_STOPWORDS.has(token)) return true;
  return ALL_STOPWORDS.has(foldAccents(token.toLowerCase()));
}

/** Per-language counts, used by GET /v1/stopwords. */
export function stopwordSummary(): Array<{ code: string; name: string; count: number }> {
  return STOPWORD_LANGUAGES.map((language) => ({
    code: language.code,
    name: language.name,
    count: STOPWORDS[language.code].length,
  }));
}
