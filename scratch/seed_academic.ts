import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Need service role for seeding bypass RLS
);

async function seed() {

  // 1. Create a Course
  const { data: course, error: cErr } = await supabase.from('courses').insert({
    title: 'Advanced Mathematics for Engineering',
    description: 'A comprehensive guide to calculus, linear algebra, and discrete mathematics.',
    subject: 'Mathematics',
    thumbnail_url: 'https://images.unsplash.com/photo-1509228468518-180dd48a579a?auto=format&fit=crop&q=80&w=800',
    is_published: true
  }).select().single();

  if (cErr) throw cErr;

  // 2. Create Lessons
  const lessons = [
    {
      course_id: course.id,
      title: 'Introduction to Derivatives',
      content_type: 'video',
      content_body: 'https://www.youtube.com/watch?v=9vKqVkMQHKk',
      sequence_order: 1,
      is_published: true
    },
    {
      course_id: course.id,
      title: 'The Chain Rule Explained',
      content_type: 'pdf',
      content_body: 'https://www.math.ubc.ca/~pwalls/math-python/differentiation/differentiation.pdf',
      sequence_order: 2,
      is_published: true
    },
    {
      course_id: course.id,
      title: 'Complex Numbers & LaTeX',
      content_type: 'latex',
      content_body: '# Complex Numbers Formula\n\nThe Euler identity is legendary:\n\n$$ e^{i\pi} + 1 = 0 $$\n\n### Task\nStudy the relationship between trigonometric and exponential forms.',
      sequence_order: 3,
      is_published: true
    }
  ];

  const { error: lErr } = await supabase.from('lessons').insert(lessons);
  if (lErr) throw lErr;

  // 3. Create Questions
  const questions = [
    {
      subject: 'Mathematics',
      text: 'What is the derivative of x^2?',
      option_a: 'x',
      option_b: '2x',
      option_c: 'x^2',
      option_d: '2',
      correct: 'B',
      explanation: 'Using the power rule: d/dx[x^n] = n*x^(n-1). So d/dx[x^2] = 2x.'
    },
    {
      subject: 'Mathematics',
      text: 'What is the value of i^2?',
      option_a: '1',
      option_b: '-1',
      option_c: 'i',
      option_d: '0',
      correct: 'B',
      explanation: 'By definition, i is the square root of -1, so i^2 = -1.'
    }
  ];

  const { data: qs, error: qErr } = await supabase.from('questions').insert(questions).select();
  if (qErr) throw qErr;

  // 4. Create a Test
  const { error: tErr } = await supabase.from('tests').insert({
    name: 'Mathematics Diagnostic Test',
    subject: 'Mathematics',
    time_limit: 15,
    question_ids: qs.map(q => q.id),
    is_published: true
  });
  if (tErr) throw tErr;
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
