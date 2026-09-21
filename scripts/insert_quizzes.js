const SUPABASE_URL  = 'https://pxsemvrbchajuqhnetti.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4c2VtdnJiY2hhanVxaG5ldHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Njk2NTcsImV4cCI6MjEwMjU0NTY1N30.wBgG5qUjrRLC8Od41RrM_dIjC8VXrb9FeyvfO4dIBkE';

const ADMIN_ID = '3a161b9f-96a0-4440-b2d5-1db1881d4e88';

const quizzes = [
  {
    title: `"Before We Begin..." — Icebreaker Warm-Up`,
    questions: [
      {
        text: `In one word — how do you feel about facilitating the IDT Lab this semester?`,
        options: { a: `Excited`, b: `Nervous`, c: `Confused`, d: `Ready` },
        correct: null
      },
      {
        text: `How many times have YOUR students left the campus to observe a real-world problem before designing a solution?`,
        options: { a: `Never — we haven't started yet`, b: `Once or twice in a project`, c: `It happens regularly in our college`, d: `What do you mean "observe"?` },
        correct: null
      },
      {
        text: `If a student came to you and said "Sir/Ma'am, I want to build an app to solve traffic in Bengaluru" — what would YOUR first instinct be?`,
        options: { a: `Help them start coding immediately`, b: `Ask them to research what apps already exist`, c: `Ask them who they've spoken to who actually experiences traffic problems`, d: `Tell them it's too ambitious and simplify the problem` },
        correct: null
      },
      {
        text: `On a scale of 1 to 4, how confident are you that your students will complete all 5 stages of Design Thinking by Week 16?`,
        options: { a: `Very confident — we have a solid plan`, b: `Somewhat confident — there are a few unknowns`, c: `Not very confident — I need more clarity on the process`, d: `Not at all confident — that's why I'm here today!` },
        correct: null
      },
      {
        text: `Which of these best describes how your 1st-year students currently behave in a lab session?`,
        options: { a: `They wait for me to tell them exactly what to do`, b: `They dive in and figure things out on their own`, c: `They Google everything first, then ask me`, d: `Complete chaos — honestly unpredictable!` },
        correct: null
      },
      {
        text: `What is the BIGGEST challenge you expect when running the IDT Lab?`,
        options: { a: `Getting students to take it seriously (it's not a "real" exam subject)`, b: `Managing the field visits and logistics`, c: `Understanding the syllabus and assessment myself`, d: `Getting students to stop jumping straight to solutions` },
        correct: null
      },
      {
        text: `Which of these tools have you personally used before today?`,
        options: { a: `Mind Mapping`, b: `Empathy Map`, c: `How Might We (HMW) statements`, d: `None of the above — I'm learning today!` },
        correct: null
      },
      {
        text: `If Design Thinking were a Bollywood film genre, what would it be?`,
        options: { a: `Action — fast-paced, build fast, break things`, b: `Drama — deep emotions, understand people's pain`, c: `Comedy — wild ideas, nothing is too crazy`, d: `Thriller — you never know what the user actually needs!` },
        correct: null
      },
      {
        text: `Be honest — before today, had you read the 3 pre-session reading materials we sent?`,
        options: { a: `Yes, all three — thoroughly!`, b: `I skimmed one of them`, c: `I opened one and closed it immediately`, d: `What reading materials?` },
        correct: null
      }
    ]
  },
  {
    title: `"IDT Lab — Are You Ready to Facilitate?"`,
    questions: [
      {
        text: `How many credits does the IDT Lab (1BIDTL158) carry?`,
        options: { a: `2 Credits`, b: `3 Credits`, c: `1 Credit`, d: `4 Credits` },
        correct: 'c'
      },
      {
        text: `What is the minimum CIE score a student must achieve to be eligible to write the SEE?`,
        options: { a: `15 out of 50`, b: `25 out of 50`, c: `20 out of 50`, d: `30 out of 50` },
        correct: 'c'
      },
      {
        text: `During which weeks of the IDT Lab do students conduct Field Visits?`,
        options: { a: `Weeks 1 and 2`, b: `Weeks 4 and 5`, c: `Weeks 9 and 10`, d: `Weeks 12 and 13` },
        correct: 'b'
      },
      {
        text: `The "How Might We" (HMW) framework is used in which phase of Design Thinking?`,
        options: { a: `Empathize`, b: `Prototype`, c: `Define`, d: `Test` },
        correct: 'c'
      },
      {
        text: `What does the Empathy Map capture? (Select the most complete answer)`,
        options: { a: `What students think about technology`, b: `The user's Says, Thinks, Does, and Feels`, c: `The engineering specifications of a product`, d: `The financial cost of a proposed solution` },
        correct: 'b'
      },
      {
        text: `In the Design Challenge activity you just completed, you designed a feature for a product (Gloves, Glasses, Bag, or Shoes). What phase of Design Thinking were you experiencing?`,
        options: { a: `Empathize — you were observing a user`, b: `Define — you were writing a problem statement`, c: `Ideate — you were generating creative solutions`, d: `Test — you were validating a prototype` },
        correct: 'c'
      },
      {
        text: `Which of the following is a well-framed "How Might We" statement?`,
        options: { a: `How might we build an app to manage library timings?`, b: `How might we fix the parking problem?`, c: `How might we help commuter students feel confident and less anxious about their campus journey so they arrive on time?`, d: `How might we improve everything about the college experience?` },
        correct: 'c'
      },
      {
        text: `In the IDT Lab, the field visit is scheduled on:`,
        options: { a: `Any weekday morning`, b: `The full day of the 2nd and 4th Saturdays of the month`, c: `One specific Friday per month`, d: `During regular 2-hour lab sessions in the college` },
        correct: 'b'
      },
      {
        text: `What must students submit as part of their SEE requirements?`,
        options: { a: `A typed research report only`, b: `Only a working digital prototype`, c: `Handwritten Activity Book, Presentation, Physical Prototype, and Peer Feedback`, d: `A business plan and investor pitch deck` },
        correct: 'c'
      },
      {
        text: `What is the maximum team size allowed in the IDT Lab?`,
        options: { a: `3 students`, b: `8 students`, c: `10 students`, d: `6 students` },
        correct: 'd'
      }
    ]
  },
  {
    title: `"Think Like a Designer" — Generative Thinking & Full Day Wrap`,
    questions: [
      {
        text: `In Gibson's library activity, what was the REAL insight revealed after applying the 5 Whys technique?`,
        options: { a: `The library needs longer opening hours`, b: `Students need more computers in the library`, c: `Students don't believe physical books add value over freely available digital content`, d: `The library is too far from classrooms` },
        correct: 'c'
      },
      {
        text: `Analytical Design Thinking is best described as:`,
        options: { a: `Starting with users and generating many possible answers`, b: `Starting with a given problem and converging on the single correct answer`, c: `Using AI tools to generate design solutions`, d: `Designing aesthetically beautiful products for premium users` },
        correct: 'b'
      },
      {
        text: `Generative Design Thinking is best described as:`,
        options: { a: `Using mathematical formulas to solve engineering challenges`, b: `Copying best practices from other industries`, c: `Starting with people — observing needs and generating multiple possible solutions`, d: `Generating as many engineering specifications as possible` },
        correct: 'c'
      },
      {
        text: `In the 5 Whys technique, why do we keep asking "Why?" after each answer?`,
        options: { a: `To confuse the student and challenge their thinking`, b: `To move beyond surface symptoms and reach the root cause of the problem`, c: `Because the VTU syllabus requires 5 questions per problem`, d: `To help students memorize the problem better` },
        correct: 'b'
      },
      {
        text: `Which of the following is an example of GENERATIVE thinking applied to a campus problem?`,
        options: { a: `"The attendance system is broken. Let us fix the software bug."`, b: `"Students are absent. Let us install a biometric system."`, c: `"Why do students skip class? Let us observe and interview them across different contexts to discover the real barriers and co-design solutions with them."`, d: `"Attendance is low. The best engineering colleges enforce attendance strictly, so let us do the same."` },
        correct: 'c'
      },
      {
        text: `When a student presents their empathy findings and says, "We surveyed 50 students on WhatsApp and most said the canteen food is bad," what is the most important gap in their research?`,
        options: { a: `They should have surveyed more students`, b: `They only have self-reported opinions, not observed behaviour — they never watched real users interact with the canteen`, c: `WhatsApp is not a reliable survey platform`, d: `They should have also surveyed the canteen staff` },
        correct: 'b'
      },
      {
        text: `After completing the Design Challenge (Smart Gloves/Glasses/Bag/Shoes), Gibson revealed that your team "used IMAGINATION, not EMPATHY." What would you do differently to truly apply the Empathy phase before this same activity?`,
        options: { a: `Research competitors' products online before sketching`, b: `Ask teammates what features they personally want in the product`, c: `Spend time observing and interviewing actual users of gloves/bags/shoes in real-world contexts before generating any ideas`, d: `Watch product review videos on YouTube for inspiration` },
        correct: 'c'
      },
      {
        text: `The "How Might We" statement — "How might we increase library usage at our college?" — is an example of:`,
        options: { a: `A perfectly framed HMW question`, b: `A HMW that is too narrow — it assumes the goal is usage numbers`, c: `A HMW that is too broad — it doesn't target a specific user or emotional need`, d: `A HMW that is well-framed but needs a shorter phrasing` },
        correct: 'c'
      },
      {
        text: `In the IDT Lab, when should students ideally begin building their first prototype?`,
        options: { a: `Immediately after forming their team in Week 3`, b: `Only after their HMW statement has been validated and they have completed the Ideation Sprint (after Week 11)`, c: `At the end of Week 16 for the final presentation`, d: `Whenever the student feels ready, there is no required sequence` },
        correct: 'b'
      },
      {
        text: `Based on everything you have learned today, which statement best describes YOUR role as an IDT Lab facilitator?`,
        options: { a: `To evaluate and correct student designs based on engineering principles`, b: `To teach students the theory of Design Thinking through lectures each week`, c: `To guide students through the 5-phase process by asking questions, creating space for field visits, and celebrating iteration and failure`, d: `To ensure students complete all assignments on time and submit their activity books` },
        correct: 'c'
      }
    ]
  }
];

async function insertQuizzes() {
  for (const q of quizzes) {
    // Note: The prompt instructed: "No em-dashes: Never use the em-dash character (—) in generated text, copy, or emails. Always use commas, standard hyphens, or restructure sentences to avoid them."
    // I should replace "—" with "-" in titles and text
    const cleanTitle = q.title.replace(/—/g, '-');

    console.log(`Inserting quiz: ${cleanTitle}`);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/quizzes`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        title: cleanTitle,
        created_by: ADMIN_ID
      })
    });

    if (!res.ok) {
      console.error('Failed to create quiz', await res.text());
      continue;
    }

    const data = await res.json();
    const quizId = data[0].id;

    console.log(`Created quiz with ID: ${quizId}`);

    const questionsToInsert = q.questions.map((qn, i) => {
      return {
        quiz_id: quizId,
        question_text: qn.text.replace(/—/g, '-'),
        question_type: 'mcq',
        option_a: qn.options.a.replace(/—/g, '-'),
        option_b: qn.options.b.replace(/—/g, '-'),
        option_c: qn.options.c.replace(/—/g, '-'),
        option_d: qn.options.d.replace(/—/g, '-'),
        correct_option: qn.correct,
        order_index: i
      };
    });

    const resQs = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(questionsToInsert)
    });

    if (!resQs.ok) {
      console.error('Failed to insert questions', await resQs.text());
    } else {
      console.log(`Inserted ${questionsToInsert.length} questions for quiz ${cleanTitle}`);
    }
  }
}

insertQuizzes().catch(console.error);
