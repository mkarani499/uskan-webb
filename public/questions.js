// ============================================================
// BRAIN TEST - 33 Engaging Questions
// Categories: Abstract, Memory, Spatial, Verbal, Speed
// ============================================================

const brainQuestions = [
    // ============================================================
    // ABSTRACT REASONING (7 Questions)
    // ============================================================
    
    // --- Easy (3) ---
    {
        id: 1,
        category: "abstract",
        difficulty: "easy",
        timer: 15,
        question: "Which option completes the pattern?",
        image: "⬆ → ⬇ → ⬅ → ?",
        options: ["⬆", "⬇", "➡", "⬅"],
        correct: 2,
        explanation: "The arrows rotate 90° clockwise each step."
    },
    {
        id: 2,
        category: "abstract",
        difficulty: "easy",
        timer: 15,
        question: "Which option completes the pattern?",
        image: "● → ●● → ●●● → ?",
        options: ["●●●", "●●", "●●●●", "●"],
        correct: 2,
        explanation: "The number of dots increases by 1 each step."
    },
    {
        id: 3,
        category: "abstract",
        difficulty: "easy",
        timer: 15,
        question: "Which option completes the pattern?",
        image: "△ → ▲ → △ → ?",
        options: ["△", "▽", "▼", "▲"],
        correct: 3,
        explanation: "The triangle alternates between pointing up and down."
    },
    
    // --- Medium (2) ---
    {
        id: 4,
        category: "abstract",
        difficulty: "medium",
        timer: 20,
        question: "Which option completes the pattern?",
        image: "○ → ○○ → ○○○ → ○○ → ○ → ?",
        options: ["○○○", "○○", "○", "○○○○"],
        correct: 2,
        explanation: "The pattern increases to 3, then decreases back to 1."
    },
    {
        id: 5,
        category: "abstract",
        difficulty: "medium",
        timer: 20,
        question: "Which option completes the pattern?",
        image: "□ → ■ → □□ → ■■ → □□□ → ?",
        options: ["■■■", "□□□", "■■", "□"],
        correct: 0,
        explanation: "The pattern alternates: 1 square, 1 filled, 2 squares, 2 filled, 3 squares, 3 filled."
    },
    
    // --- Hard (2) ---
    {
        id: 6,
        category: "abstract",
        difficulty: "hard",
        timer: 25,
        question: "Which option completes the pattern?",
        image: "△  ▷  ▷▷ | ▷  ▷▷  △ | ▷▷  △  ?",
        options: ["▷▷", "△", "▷", "△△"],
        correct: 2,
        explanation: "Shapes rotate and combine in sequence across rows and columns."
    },
    {
        id: 7,
        category: "abstract",
        difficulty: "hard",
        timer: 25,
        question: "Which option completes the pattern?",
        image: "★  ☆  ★★ | ☆  ★★  ★ | ★★  ★  ?",
        options: ["★★", "☆", "★", "☆☆"],
        correct: 1,
        explanation: "The pattern follows: 1 star, 1 empty, 2 stars, 1 empty, 2 stars, 1 star, 2 stars, 1 star, 1 empty."
    },

    // ============================================================
    // MEMORY & RECALL (6 Questions)
    // ============================================================
    
    // --- Easy (2) ---
    {
        id: 8,
        category: "memory",
        difficulty: "easy",
        timer: 3.5,
        question: "What was the number sequence?",
        image: "3-7-2-9-4",
        options: ["3-7-2-4-9", "7-3-2-9-4", "3-7-2-9-4", "3-7-9-2-4"],
        correct: 2,
        explanation: "The correct sequence was 3-7-2-9-4."
    },
    {
        id: 9,
        category: "memory",
        difficulty: "easy",
        timer: 3.5,
        question: "What was the number sequence?",
        image: "8-1-5-3-6",
        options: ["8-5-1-3-6", "8-1-3-5-6", "1-8-5-3-6", "8-1-5-3-6"],
        correct: 3,
        explanation: "The correct sequence was 8-1-5-3-6."
    },
    
    // --- Medium (2) ---
    {
        id: 10,
        category: "memory",
        difficulty: "medium",
        timer: 3.5,
        question: "What was the number sequence?",
        image: "6-2-8-4-1-7",
        options: ["6-2-8-1-4-7", "2-6-8-4-1-7", "6-2-8-4-1-7", "6-8-2-4-1-7"],
        correct: 2,
        explanation: "The correct sequence was 6-2-8-4-1-7."
    },
    {
        id: 11,
        category: "memory",
        difficulty: "medium",
        timer: 3.5,
        question: "What was the number sequence?",
        image: "5-9-3-7-2-8",
        options: ["5-9-3-7-2-8", "5-3-9-7-2-8", "9-5-3-7-2-8", "5-9-7-3-2-8"],
        correct: 0,
        explanation: "The correct sequence was 5-9-3-7-2-8."
    },
    
    // --- Hard (2) ---
    {
        id: 12,
        category: "memory",
        difficulty: "hard",
        timer: 3.5,
        question: "What was the number sequence?",
        image: "7-3-9-1-6-4-8",
        options: ["7-9-3-1-6-4-8", "3-7-9-1-6-4-8", "7-3-9-6-1-4-8", "7-3-9-1-6-4-8"],
        correct: 3,
        explanation: "The correct sequence was 7-3-9-1-6-4-8."
    },
    {
        id: 13,
        category: "memory",
        difficulty: "hard",
        timer: 3.5,
        question: "What was the number sequence?",
        image: "2-8-5-1-9-3-7",
        options: ["2-8-5-1-9-3-7", "2-5-8-1-9-3-7", "8-2-5-1-9-3-7", "2-8-5-9-1-3-7"],
        correct: 0,
        explanation: "The correct sequence was 2-8-5-1-9-3-7."
    },

    // ============================================================
    // SPATIAL AWARENESS (7 Questions)
    // ============================================================
    
    // --- Easy (3) ---
    {
        id: 14,
        category: "spatial",
        difficulty: "easy",
        timer: 15,
        question: "Which shape is a mirror image of the one shown?",
        image: "◁",
        options: ["◂", "▸", "◁", "▷"],
        correct: 3,
        explanation: "The mirror image of ◁ is ▷."
    },
    {
        id: 15,
        category: "spatial",
        difficulty: "easy",
        timer: 15,
        question: "Which shape is a 90° rotation of the one shown?",
        image: "△",
        options: ["▷", "△", "▽", "◁"],
        correct: 2,
        explanation: "A 90° rotation of △ is ▽."
    },
    {
        id: 16,
        category: "spatial",
        difficulty: "easy",
        timer: 15,
        question: "Which option shows the same shape rotated?",
        image: "⬛",
        options: ["▣", "⬛", "▢", "⬜"],
        correct: 1,
        explanation: "⬛ is the same shape, just rotated 90°."
    },
    
    // --- Medium (2) ---
    {
        id: 17,
        category: "spatial",
        difficulty: "medium",
        timer: 20,
        question: "Which shape completes the sequence?",
        image: "◢ → ◣ → ◤ → ?",
        options: ["◣", "◢", "◥", "◤"],
        correct: 2,
        explanation: "The triangles rotate 90° counter-clockwise each step."
    },
    {
        id: 18,
        category: "spatial",
        difficulty: "medium",
        timer: 20,
        question: "Which shape is a mirror image of the one shown?",
        image: "◐",
        options: ["◒", "◑", "◐", "◓"],
        correct: 1,
        explanation: "The mirror image of ◐ is ◑."
    },
    
    // --- Hard (2) ---
    {
        id: 19,
        category: "spatial",
        difficulty: "hard",
        timer: 25,
        question: "Which shape completes the sequence?",
        image: "◐ → ◑ → ◒ → ?",
        options: ["◑", "◓", "◐", "◒"],
        correct: 1,
        explanation: "The circles rotate through different patterns."
    },
    {
        id: 20,
        category: "spatial",
        difficulty: "hard",
        timer: 25,
        question: "Which shape completes the pattern?",
        image: "⬛⬜⬛ | ⬜⬛⬜ | ⬛⬜?",
        options: ["▢", "⬛", "▣", "⬜"],
        correct: 1,
        explanation: "The pattern alternates ⬛ and ⬜ in a checkerboard pattern."
    },

    // ============================================================
    // VERBAL REASONING (6 Questions)
    // ============================================================
    
    // --- Easy (2) ---
    {
        id: 21,
        category: "verbal",
        difficulty: "easy",
        timer: 15,
        question: "Hot is to Cold as Light is to:",
        image: "",
        options: ["Sun", "Lamp", "Bright", "Dark"],
        correct: 3,
        explanation: "Hot is the opposite of Cold, so Light is the opposite of Dark."
    },
    {
        id: 22,
        category: "verbal",
        difficulty: "easy",
        timer: 15,
        question: "Dog is to Puppy as Cat is to:",
        image: "",
        options: ["Cat", "Kitty", "Feline", "Kitten"],
        correct: 3,
        explanation: "A young dog is a puppy, so a young cat is a kitten."
    },
    
    // --- Medium (2) ---
    {
        id: 23,
        category: "verbal",
        difficulty: "medium",
        timer: 20,
        question: "All dogs are animals. Some animals are cats. Therefore:",
        image: "",
        options: [
            "Some animals are dogs",
            "All dogs are cats",
            "Some dogs are cats",
            "All animals are dogs"
        ],
        correct: 0,
        explanation: "If all dogs are animals, then some animals (the dogs) are dogs."
    },
    {
        id: 24,
        category: "verbal",
        difficulty: "medium",
        timer: 20,
        question: "If you rearrange the letters of 'CIFAIPC', you get the name of a:",
        image: "",
        options: ["Country", "City", "Planet", "Ocean"],
        correct: 3,
        explanation: "'CIFAIPC' rearranged is 'PACIFIC'—which is an ocean."
    },
    
    // --- Hard (2) ---
    {
        id: 25,
        category: "verbal",
        difficulty: "hard",
        timer: 25,
        question: "Tree is to Forest as Star is to:",
        image: "",
        options: ["Universe", "Sky", "Night", "Galaxy"],
        correct: 3,
        explanation: "A tree is part of a forest, and a star is part of a galaxy."
    },
    {
        id: 26,
        category: "verbal",
        difficulty: "hard",
        timer: 25,
        question: "If all zips are zaps, and some zaps are zops, which is true?",
        image: "",
        options: [
            "All zips are zops",
            "Some zaps are zips",
            "Some zips are zops",
            "All zops are zips"
        ],
        correct: 1,
        explanation: "If all zips are zaps, then some zaps (the zips) are zips."
    },

    // ============================================================
    // PROCESSING SPEED (7 Questions)
    // ============================================================
    
    // --- Easy (3) ---
    {
        id: 27,
        category: "speed",
        difficulty: "easy",
        timer: 5,
        question: "Which symbol appears most frequently?",
        image: "⬛ ⬜ ⬛ ⬜ ⬛ ⬛ ⬜ ⬛ ⬜ ⬛",
        options: ["⬜", "Equal", "Can't tell", "⬛"],
        correct: 3,
        explanation: "⬛ appears 6 times vs. 4 times for ⬜."
    },
    {
        id: 28,
        category: "speed",
        difficulty: "easy",
        timer: 5,
        question: "Which symbol appears most frequently?",
        image: "● ○ ● ○ ● ● ○ ● ○ ●",
        options: ["○", "●", "Equal", "Can't tell"],
        correct: 1,
        explanation: "● appears 6 times vs. 4 times for ○."
    },
    {
        id: 29,
        category: "speed",
        difficulty: "easy",
        timer: 5,
        question: "Which symbol appears most frequently?",
        image: "★ ☆ ★ ☆ ★ ★ ☆ ★ ☆ ★",
        options: ["☆", "Equal", "Can't tell", "★"],
        correct: 3,
        explanation: "★ appears 6 times vs. 4 times for ☆."
    },
    
    // --- Medium (2) ---
    {
        id: 30,
        category: "speed",
        difficulty: "medium",
        timer: 6,
        question: "What is 14 + 7 + 9?",
        image: "",
        options: ["29", "28", "31", "30"],
        correct: 3,
        explanation: "14 + 7 = 21, + 9 = 30."
    },
    {
        id: 31,
        category: "speed",
        difficulty: "medium",
        timer: 6,
        question: "What is 22 + 8 + 5?",
        image: "",
        options: ["34", "36", "35", "33"],
        correct: 2,
        explanation: "22 + 8 = 30, + 5 = 35."
    },
    
    // --- Hard (2) ---
    {
        id: 32,
        category: "speed",
        difficulty: "hard",
        timer: 4,
        question: "What is 17 + 8 + 3?",
        image: "",
        options: ["27", "28", "30", "25"],
        correct: 1,
        explanation: "17 + 8 = 25, + 3 = 28."
    },
    {
        id: 33,
        category: "speed",
        difficulty: "hard",
        timer: 4,
        question: "What is 19 + 6 + 4?",
        image: "",
        options: ["28", "27", "30", "29"],
        correct: 3,
        explanation: "19 + 6 = 25, + 4 = 29."
    }
];