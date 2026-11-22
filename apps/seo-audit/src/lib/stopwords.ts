/**
 * Stopword and common-word lists used by the keyword extraction.
 *
 * STOPWORDS are dropped from unigram counts and never form bigrams. The list is
 * standard English stopwords plus a handful of pure UI chrome words ("menu",
 * "subscribe") that would otherwise dominate navigation-heavy pages. Topical
 * words that also appear in navigation are kept.
 *
 * COMMON_WORDS participate in the IDF-style prior: frequent but meaningful words
 * get a lower weight than rare topical words.
 */

export const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "about", "above", "after", "again", "against", "all", "almost", "also", "am", "an",
  "and", "another", "any", "anyone", "anything", "are", "aren", "arent", "around", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can", "cannot", "cant", "could", "couldn", "couldnt", "did", "didn", "didnt", "do", "does",
  "doesn", "doesnt", "doing", "don", "dont", "down", "during",
  "each", "either", "else", "enough", "etc", "even", "ever", "every", "everyone", "everything",
  "few", "for", "from", "further", "get", "gets", "getting", "go", "goes", "going", "gone",
  "got", "had", "hadn", "hadnt", "has", "hasn", "hasnt", "have", "haven", "havent", "having",
  "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "however",
  "i", "if", "in", "into", "is", "isn", "isnt", "it", "its", "itself", "just",
  "keep", "kept", "know", "known", "last", "less", "let", "lets", "like", "likely", "long",
  "made", "make", "makes", "making", "many", "may", "me", "might", "mine", "more", "most",
  "much", "must", "my", "myself", "need", "needs", "neither", "never", "new", "next", "no",
  "nobody", "none", "nor", "not", "nothing", "now", "of", "off", "often", "on", "once", "one",
  "only", "onto", "or", "other", "others", "otherwise", "our", "ours", "ourselves", "out",
  "over", "own", "per", "perhaps", "put", "rather", "really", "said", "same", "say", "says",
  "see", "seem", "seems", "several", "shall", "she", "should", "shouldn", "shouldnt", "since",
  "so", "some", "someone", "something", "sometimes", "still", "such", "take", "taken", "than",
  "that", "thats", "the", "their", "theirs", "them", "themselves", "then", "there", "these",
  "they", "thing", "things", "think", "this", "those", "though", "through", "thus", "to",
  "together", "too", "toward", "towards", "under", "until", "up", "upon", "us", "use", "used",
  "uses", "using", "very", "via", "want", "wants", "was", "wasn", "wasnt", "way", "we",
  "well", "went", "were", "weren", "werent", "what", "whatever", "when", "where", "whether",
  "which", "while", "who", "whom", "whose", "why", "will", "with", "within", "without",
  "won", "wont", "would", "wouldn", "wouldnt", "yes", "yet", "you", "your", "yours",
  "yourself", "yourselves",
  // unambiguous UI chrome only: words that are never the topic of a page.
  // Topical terms that also appear in navigation ("search", "privacy",
  // "cookies", "read") are deliberately kept analysable.
  "click", "menu", "skip", "toggle", "share", "subscribe", "newsletter", "login",
  "copyright", "reserved",
]);

export const COMMON_WORDS: ReadonlySet<string> = new Set([
  "add", "able", "across", "act", "action", "actually", "age", "ago", "agree", "air", "allow",
  "already", "always", "among", "amount", "answer", "appear", "apply", "area", "argue", "ask",
  "available", "avoid", "bad", "based", "become", "begin", "behind", "believe", "best", "better",
  "big", "body", "book", "bring", "build", "business", "buy", "call", "called", "car", "care",
  "case", "cause", "center", "change", "check", "child", "children", "choose", "city", "class",
  "clear", "close", "come", "company", "consider", "continue", "control", "cost", "country",
  "course", "create", "current", "data", "day", "days", "deal", "decide", "decision", "develop",
  "different", "difficult", "done", "door", "early", "easy", "eat", "effect", "end", "end",
  "example", "expect", "experience", "eye", "face", "fact", "family", "far", "fast", "feel",
  "felt", "field", "figure", "final", "find", "fine", "follow", "follow", "food", "form",
  "found", "free", "friend", "full", "fund", "game", "general", "give", "given", "glass", "goal",
  "good", "great", "green", "group", "grow", "growth", "hand", "happen", "happy", "hard", "head",
  "health", "hear", "heart", "heavy", "high", "history", "hold", "hope", "hour", "house", "human",
  "idea", "image", "important", "include", "increase", "industry", "information", "interest",
  "issue", "item", "job", "join", "key", "kid", "kind", "land", "large", "later", "lead",
  "learn", "leave", "left", "level", "life", "light", "line", "link", "list", "little", "live",
  "local", "look", "lose", "loss", "love", "low", "main", "major", "market", "matter", "mean",
  "measure", "meet", "member", "message", "mind", "minute", "miss", "model", "money", "month",
  "move", "name", "national", "natural", "near", "need", "network", "news", "number", "offer",
  "office", "old", "open", "order", "page", "paper", "parent", "part", "party", "pay", "people",
  "person", "place", "plan", "play", "point", "political", "position", "possible", "power",
  "present", "president", "press", "price", "private", "problem", "process", "product", "program",
  "project", "provide", "public", "pull", "purpose", "push", "question", "quick", "quite", "raise",
  "range", "rate", "reach", "read", "ready", "real", "reason", "receive", "record", "red",
  "reduce", "region", "remain", "remember", "report", "require", "research", "resource", "respond",
  "result", "return", "reveal", "rich", "rise", "risk", "road", "rock", "role", "room", "rule",
  "run", "safe", "save", "school", "science", "score", "season", "seat", "second", "section",
  "security", "sell", "send", "sense", "series", "serious", "serve", "service", "set", "seven",
  "share", "short", "show", "side", "sign", "similar", "simple", "simply", "single", "site",
  "situation", "six", "size", "skill", "small", "social", "society", "soldier", "solution", "sort",
  "sound", "source", "south", "space", "speak", "special", "specific", "spend", "sport", "staff",
  "stage", "stand", "standard", "star", "start", "state", "statement", "station", "stay", "step",
  "stock", "stop", "store", "story", "strategy", "street", "strong", "structure", "student",
  "study", "stuff", "style", "subject", "success", "successful", "sudden", "suffer", "suggest",
  "summer", "system", "table", "talk", "task", "teach", "team", "technology", "television", "tell",
  "tend", "term", "test", "thank", "themselves", "theory", "there", "third", "thought", "thousand",
  "three", "throw", "time", "times", "today", "together", "total", "tough", "toward", "town",
  "trade", "traditional", "training", "travel", "treat", "treatment", "tree", "trial", "trip",
  "trouble", "true", "truth", "try", "turn", "two", "type", "under", "understand", "unit", "until",
  "value", "various", "version", "view", "visit", "voice", "vote", "wait", "walk", "wall", "watch",
  "water", "week", "weight", "west", "whole", "wide", "wife", "window", "wish", "woman", "word",
  "work", "worker", "world", "worry", "write", "writer", "wrong", "year", "young",
]);
