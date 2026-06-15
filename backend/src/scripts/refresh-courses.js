/**
 * Weekly content refresh — regenerates each course's reading material, practice
 * questions, and quiz wording using the Gemini API, then updates MongoDB IN PLACE.
 *
 * Safety guarantees (so a user's learning track is never broken):
 *   - Course `id`, `order`, `title`, `difficulty`, and `content.videos` are NEVER changed.
 *   - Quiz `id`s and the quiz COUNT are preserved exactly, so existing
 *     `courseProgress` (passed/score/attempts) stays valid.
 *   - User documents are never touched.
 *   - If Gemini returns malformed/invalid data for a course, that course is SKIPPED
 *     (its existing content is kept) rather than corrupted.
 *
 * Run locally:  GEMINI_API_KEY=... MONGO_URI=... node src/scripts/refresh-courses.js
 * In CI:        provided by the weekly GitHub Actions workflow.
 */

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const Course = require('../models/Course');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text;
}

function parseJson(text) {
  // strip code fences if the model added them
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
}

function buildPrompt(course) {
  const quizIds = course.quizzes.map((q) => q.id);
  return `You are an expert finance educator updating a learning module for everyday Pakistani investors using the Pakistan Stock Exchange (PSX).

Module title: "${course.title}"
Difficulty: ${course.difficulty}
Description: ${course.description}

Rewrite and FRESHEN the teaching content so it stays current and engaging, while staying strictly on this exact topic. Use simple language a layman can follow, Pakistan-specific examples (PSX, KSE-100, real sectors/companies like Engro, OGDC, Lucky Cement, Meezan Bank), and avoid financial advice or "guaranteed" claims.

Return STRICT JSON (no markdown, no commentary) with EXACTLY this shape:
{
  "readingMaterial": "5-7 short paragraphs separated by \\n\\n",
  "practiceQuestions": ["q1", "q2", "q3"],
  "quizzes": [
    { "id": "<one of: ${quizIds.join(', ')}>", "question": "...", "options": ["a","b","c","d"], "correctAnswer": "<must equal one of the 4 options>" }
  ]
}

Rules:
- The "quizzes" array MUST contain exactly ${course.quizzes.length} items and use these exact ids (one each, no extras, no duplicates): ${quizIds.join(', ')}.
- Each quiz MUST have exactly 4 options and a correctAnswer that is identical to one of its options.
- Keep it factual and beginner-friendly.`;
}

function validateGenerated(course, gen) {
  if (!gen || typeof gen.readingMaterial !== 'string' || gen.readingMaterial.trim().length < 100) return false;
  if (!Array.isArray(gen.practiceQuestions) || gen.practiceQuestions.length === 0) return false;
  if (!Array.isArray(gen.quizzes) || gen.quizzes.length !== course.quizzes.length) return false;

  const expectedIds = new Set(course.quizzes.map((q) => q.id));
  const seen = new Set();
  for (const q of gen.quizzes) {
    if (!q || !expectedIds.has(q.id) || seen.has(q.id)) return false;
    seen.add(q.id);
    if (typeof q.question !== 'string' || !q.question.trim()) return false;
    if (!Array.isArray(q.options) || q.options.length !== 4) return false;
    if (q.options.some((o) => typeof o !== 'string' || !o.trim())) return false;
    if (!q.options.includes(q.correctAnswer)) return false;
  }
  return true;
}

async function refresh() {
  if (!GEMINI_API_KEY) { console.error('❌ GEMINI_API_KEY not set'); process.exit(1); }
  if (!process.env.MONGO_URI) { console.error('❌ MONGO_URI not set'); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ Connected to MongoDB');

  const courses = await Course.find({}).sort({ order: 1 });
  console.log(`🔄 Refreshing ${courses.length} courses with ${GEMINI_MODEL}...`);

  let updated = 0, skipped = 0;
  for (const course of courses) {
    try {
      const text = await callGemini(buildPrompt(course));
      const gen = parseJson(text);

      if (!validateGenerated(course, gen)) {
        console.warn(`⚠️  ${course.id} (${course.title}) — invalid response, keeping existing content`);
        skipped++;
        continue;
      }

      // Update ONLY the teaching text + quiz wording. Never touch videos / ids / order.
      course.content.readingMaterial = gen.readingMaterial.trim();
      course.content.practiceQuestions = gen.practiceQuestions.map((q) => String(q).trim()).filter(Boolean);
      course.quizzes = course.quizzes.map((existing) => {
        const fresh = gen.quizzes.find((g) => g.id === existing.id);
        return fresh
          ? { id: existing.id, question: fresh.question.trim(), options: fresh.options, correctAnswer: fresh.correctAnswer }
          : existing;
      });

      await course.save();
      updated++;
      console.log(`✅ ${course.id} — refreshed`);
    } catch (err) {
      console.warn(`⚠️  ${course.id} (${course.title}) — ${err.message}; keeping existing content`);
      skipped++;
    }
  }

  console.log(`\n🎉 Done. Refreshed ${updated}, skipped ${skipped}.`);
  await mongoose.connection.close();
  process.exit(0);
}

refresh().catch((err) => { console.error('❌ Refresh failed', err); process.exit(1); });
