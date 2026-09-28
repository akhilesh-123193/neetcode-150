export const sql50Catalog = [
  [
    "Select",
    [
      ["Recyclable and Low Fat Products", "Easy", 1757],
      ["Find Customer Referee", "Easy", 584],
      ["Big Countries", "Easy", 595],
      ["Article Views I", "Easy", 1148],
      ["Invalid Tweets", "Easy", 1683],
    ],
  ],
  [
    "Basic Joins",
    [
      ["Replace Employee ID With The Unique Identifier", "Easy", 1378],
      ["Product Sales Analysis I", "Easy", 1068],
      ["Customer Who Visited but Did Not Make Any Transactions", "Easy", 1581],
      ["Rising Temperature", "Easy", 197],
      ["Average Time of Process per Machine", "Easy", 1661],
      ["Employee Bonus", "Easy", 577],
      ["Students and Examinations", "Easy", 1280],
      ["Managers with at Least 5 Direct Reports", "Medium", 570],
      ["Confirmation Rate", "Medium", 1934],
    ],
  ],
  [
    "Basic Aggregate Functions",
    [
      ["Not Boring Movies", "Easy", 620],
      ["Average Selling Price", "Easy", 1251],
      ["Project Employees I", "Easy", 1075],
      ["Percentage of Users Attended a Contest", "Easy", 1633],
      ["Queries Quality and Percentage", "Easy", 1211],
      ["Monthly Transactions I", "Medium", 1193],
      ["Immediate Food Delivery II", "Medium", 1174],
      ["Game Play Analysis IV", "Medium", 550],
    ],
  ],
  [
    "Sorting and Grouping",
    [
      ["Number of Unique Subjects Taught by Each Teacher", "Easy", 2356],
      ["User Activity for the Past 30 Days I", "Easy", 1141],
      ["Product Sales Analysis III", "Medium", 1070],
      ["Classes More Than 5 Students", "Easy", 596],
      ["Find Followers Count", "Easy", 1729],
      ["Biggest Single Number", "Easy", 619],
      ["Customers Who Bought All Products", "Medium", 1045],
    ],
  ],
  [
    "Advanced Select and Joins",
    [
      ["The Number of Employees Which Report to Each Employee", "Easy", 1731],
      ["Primary Department for Each Employee", "Easy", 1789],
      ["Triangle Judgement", "Easy", 610],
      ["Consecutive Numbers", "Medium", 180],
      ["Product Price at a Given Date", "Medium", 1164],
      ["Last Person to Fit in the Bus", "Medium", 1204],
      ["Count Salary Categories", "Medium", 1907],
    ],
  ],
  [
    "Subqueries",
    [
      ["Employees Whose Manager Left the Company", "Easy", 1978],
      ["Exchange Seats", "Medium", 626],
      ["Movie Rating", "Medium", 1341],
      ["Restaurant Growth", "Medium", 1321],
      ["Investments in 2016", "Medium", 585],
      ["Friend Requests II: Who Has the Most Friends", "Medium", 602],
      ["Department Top Three Salaries", "Hard", 185],
    ],
  ],
  [
    "Advanced String Functions / Regex / Clause",
    [
      ["Fix Names in a Table", "Easy", 1667],
      ["Patients With a Condition", "Easy", 1527],
      ["Delete Duplicate Emails", "Easy", 196],
      ["Second Highest Salary", "Medium", 176],
      ["Group Sold Products By The Date", "Easy", 1484],
      ["List the Products Ordered in a Period", "Easy", 1327],
      ["Find Users With Valid E-Mails", "Easy", 1517],
    ],
  ],
];

export const sqlTopics = [
  "All topics",
  "Select",
  "Basic Joins",
  "Basic Aggregate Functions",
  "Sorting and Grouping",
  "Advanced Select and Joins",
  "Subqueries",
  "Advanced String Functions / Regex / Clause",
];

export function getSqlLeetCodeUrl(title) {
  const customSlugs = {
    "Friend Requests II: Who Has the Most Friends":
      "friend-requests-ii-who-has-the-most-friends",
    "Find Users With Valid E-Mails": "find-users-with-valid-e-mails",
  };
  if (customSlugs[title]) {
    return `https://leetcode.com/problems/${customSlugs[title]}/`;
  }
  const slug = title
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `https://leetcode.com/problems/${slug}/`;
}

export const sql50StarterProblems = sql50Catalog
  .flatMap(([category, problems]) =>
    problems.map(([title, difficulty, leetcodeId]) => ({
      title,
      category,
      difficulty,
      leetcodeId,
    })),
  )
  .map((problem, index) => ({
    id: 1000 + index + 1,
    track: "sql",
    ...problem,
    url: getSqlLeetCodeUrl(problem.title),
    status: "new",
    repetitions: 0,
    nextReview: null,
    plannedDate: null,
    solvedAt: null,
    sqlCode: "",
    pythonCode: "",
    timeComplexity: "",
    spaceComplexity: "",
    notes: "",
    solveHistory: [],
  }));
