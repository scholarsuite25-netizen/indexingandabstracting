export interface Chapter {
  position: number;
  title: string;
}

export interface Module {
  position: number;
  title: string;
  summary: string;
  chapters: Chapter[];
}

export const COURSE = {
  code: "LIS 815",
  title: "Indexing and Abstracting",
  tagline: "A beginner-friendly guide to subject indexing, vocabulary control and abstracting",
  description:
    "Postgraduate study of the principles and practice of representing document subjects for retrieval: subject analysis and indexes, controlled vocabularies and thesaurus construction, pre-coordinate and post-coordinate systems, search strategies, evaluation measures, abstracting, and digital, automated and AI-assisted indexing.",
} as const;

export const MODULES: Module[] = [
  {
    position: 1,
    title: "Theoretical Foundations and Types of Indexes",
    summary:
      "What subject indexing is and why it exists, the objectives and principles that guide it, the parts of an index, and how meaning and structure operate in indexing languages.",
    chapters: [
      { position: 1, title: "Fundamentals and Objectives of Subject Indexing" },
      { position: 2, title: "Types of Indexes and Book Indexing" },
      { position: 3, title: "Semantics and Syntax in Assigned Indexing" },
    ],
  },
  {
    position: 2,
    title: "Vocabulary Control",
    summary:
      "Why controlled vocabularies are needed, how a retrieval thesaurus is designed, how preferred terms and BT/NT/RT/USE/UF relationships are built, and how a thesaurus is displayed and maintained.",
    chapters: [
      { position: 4, title: "Thesaurus Construction: Design and Term Selection" },
      { position: 5, title: "Thesaurus Construction: Structure and Maintenance" },
    ],
  },
  {
    position: 3,
    title: "Pre-Coordinate Indexing Systems",
    summary:
      "Systems where the indexer combines concepts before any search takes place: chain indexing, cyclic indexing, SLIC and PRECIS with its role operators.",
    chapters: [
      { position: 6, title: "Classic Pre-Coordinate Techniques" },
      { position: 7, title: "Permuted and Algorithmic Systems" },
    ],
  },
  {
    position: 4,
    title: "Post-Coordinate and Derived Indexing",
    summary:
      "Systems where concepts are combined at retrieval time — Uniterm, free-text and Boolean searching — together with derived indexing, KWIC and KWOC.",
    chapters: [
      { position: 8, title: "Post-Coordinate Indexing Systems" },
      { position: 9, title: "Search Strategies and Derived Indexing" },
    ],
  },
  {
    position: 5,
    title: "Performance Evaluation and System Metrics",
    summary:
      "How indexing systems are evaluated: relevance, exhaustivity and specificity, the Cranfield tradition, and the calculation of precision, recall and fallout.",
    chapters: [
      { position: 10, title: "Evaluation Methodologies" },
      { position: 11, title: "Precision, Recall and Search Optimisation" },
    ],
  },
  {
    position: 6,
    title: "Abstracting Principles and Applications",
    summary:
      "What abstracts are and how they are written — indicative, informative, critical, slant and structured types — and how abstracts serve CAS, SDI and scholarly databases.",
    chapters: [
      { position: 12, title: "Abstracting Techniques and Types" },
      { position: 13, title: "Uses and Applications of Abstracts" },
    ],
  },
  {
    position: 7,
    title: "Digital, Automated and AI-Assisted Indexing",
    summary:
      "Automatic and computer-assisted indexing, hyperlinked and dynamic indexes, what artificial intelligence can and cannot do, and the continuing role of human judgement.",
    chapters: [
      {
        position: 14,
        title: "Automatic Indexing, Computer-Assisted Tools and Artificial Intelligence",
      },
    ],
  },
];

export const LEARNING_OUTCOMES: string[] = [
  "Define subject indexing and subject analysis, and relate indexing decisions to the information needs of users.",
  "Distinguish the major types of indexes and explain the stages of preparing a book index.",
  "Apply semantics and syntax: equivalence, hierarchy, association, role operators and citation order.",
  "Construct a thesaurus entry with BT, NT, RT, USE and UF relationships, and explain its maintenance.",
  "Compare pre-coordinate and post-coordinate indexing, including chain, cyclic, SLIC, PRECIS, Uniterm and KWIC/KWOC.",
  "Formulate a search strategy with Boolean operators and derive index terms from documents.",
  "Calculate precision, recall and fallout, and explain exhaustivity, specificity and the Cranfield tradition.",
  "Write indicative, informative, critical and structured abstracts, and evaluate abstracting services.",
  "Assess automatic and AI-assisted indexing, and explain why human judgement remains necessary.",
];

export const ASSESSMENT_FACTS = {
  objective: {
    questions: 100,
    optionsPerQuestion: 4,
    marksPerQuestion: 1,
    totalMarks: 100,
    durationMinutes: 90,
    durationLabel: "1 hour 30 minutes",
    passMark: 70,
  },
  theory: {
    questions: 7,
    answer: 5,
    marksPerQuestion: 20,
    totalMarks: 100,
    durationMinutes: 120,
    durationLabel: "2 hours",
  },
  weights: [
    { component: "Indexing Practicum", weight: "20%", preparation: "Thesaurus entry design, book-index construction, and PRECIS exercises" },
    { component: "Abstracting Portfolio", weight: "15%", preparation: "Indicative, informative, and critical abstracts" },
    { component: "Mid-Term Assessment", weight: "15%", preparation: "Pre-coordinate versus post-coordinate analysis" },
    { component: "Final Examination", weight: "50%", preparation: "Comprehensive theory and practical examination, including digital and AI-assisted indexing" },
  ],
} as const;
