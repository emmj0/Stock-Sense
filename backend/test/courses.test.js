const { app, request, registerUser, bearer } = require('./helpers');
const Course = require('../src/models/Course');

async function seedCourse() {
  await Course.create({
    id: 'course_1',
    title: 'Basics of PSX',
    difficulty: 'beginner',
    description: 'Intro course',
    order: 1,
    content: {
      readingMaterial: 'Some reading material about the Pakistan Stock Exchange.',
      practiceQuestions: ['What is a share?'],
      videos: [{ title: 'Intro video', youtubeId: 'vid1' }],
    },
    quizzes: [
      { id: 'q1', question: 'Pakistan main exchange?', options: ['PSX', 'NSE', 'BSE', 'NASDAQ'], correctAnswer: 'PSX' },
      { id: 'q2', question: 'A share means?', options: ['Loan', 'Ownership', 'Tax', 'Donation'], correctAnswer: 'Ownership' },
    ],
  });
}

describe('Courses API — effort gate & quiz', () => {
  test('course detail hides the correct answers', async () => {
    await seedCourse();
    const { token } = await registerUser();
    const res = await request(app).get('/api/courses/course_1').set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.course.content.videos).toHaveLength(1);
    expect(res.body.course.quizzes[0].correctAnswer).toBeUndefined();
  });

  test('quiz is blocked until reading, all videos, and practice are done', async () => {
    await seedCourse();
    const { token } = await registerUser();
    const h = bearer(token);

    const blocked = await request(app)
      .post('/api/courses/course_1/submit-quiz')
      .set('Authorization', h)
      .send({ answers: [{ quizId: 'q1', selectedAnswer: 'PSX' }, { quizId: 'q2', selectedAnswer: 'Ownership' }] });
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/reading|videos|practice/i);

    // put in the effort
    await request(app).post('/api/courses/course_1/reading-complete').set('Authorization', h);
    await request(app).post('/api/courses/course_1/video-watched').set('Authorization', h).send({ youtubeId: 'vid1' });
    await request(app).post('/api/courses/course_1/practice-complete').set('Authorization', h);

    const passed = await request(app)
      .post('/api/courses/course_1/submit-quiz')
      .set('Authorization', h)
      .send({ answers: [{ quizId: 'q1', selectedAnswer: 'PSX' }, { quizId: 'q2', selectedAnswer: 'Ownership' }] });
    expect(passed.status).toBe(200);
    expect(passed.body.quizScore).toBe(100);
    expect(passed.body.quizPassed).toBe(true);
  });

  test('a low score does not pass (60% threshold)', async () => {
    await seedCourse();
    const { token } = await registerUser();
    const h = bearer(token);
    await request(app).post('/api/courses/course_1/reading-complete').set('Authorization', h);
    await request(app).post('/api/courses/course_1/video-watched').set('Authorization', h).send({ youtubeId: 'vid1' });
    await request(app).post('/api/courses/course_1/practice-complete').set('Authorization', h);

    const res = await request(app)
      .post('/api/courses/course_1/submit-quiz')
      .set('Authorization', h)
      .send({ answers: [{ quizId: 'q1', selectedAnswer: 'NSE' }, { quizId: 'q2', selectedAnswer: 'Loan' }] });
    expect(res.body.quizScore).toBe(0);
    expect(res.body.quizPassed).toBe(false);
  });

  test('notes save and load per course', async () => {
    await seedCourse();
    const { token } = await registerUser();
    const h = bearer(token);

    const save = await request(app).put('/api/courses/course_1/notes').set('Authorization', h).send({ content: 'my note' });
    expect(save.status).toBe(200);

    const load = await request(app).get('/api/courses/course_1/notes').set('Authorization', h);
    expect(load.body.content).toBe('my note');
  });
});
