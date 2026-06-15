/**
 * Seed script to populate courses from course.json into MongoDB
 * Run with: node src/scripts/seed.js
 */

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const Course = require('../models/Course');
const coursesData = require('../../course.json');
const courseVideos = require('../../course-videos.json');

async function seedCourses() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI not set in environment');
      process.exit(1);
    }

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing courses
    console.log('🗑️  Clearing existing courses...');
    await Course.deleteMany({});
    console.log('✅ Existing courses cleared');

    // Add order to each course + attach the curated videos for that course
    const coursesWithOrder = coursesData.courses.map((course, index) => ({
      ...course,
      order: index + 1, // 1-based ordering
      content: {
        ...course.content,
        videos: courseVideos[course.id] || course.content.videos || [],
      },
    }));

    // Insert all courses
    console.log(`📚 Inserting ${coursesWithOrder.length} courses...`);
    const insertedCourses = await Course.insertMany(coursesWithOrder);
    
    console.log('\n✅ Successfully seeded courses:');
    insertedCourses.forEach((course, index) => {
      console.log(`   ${index + 1}. ${course.title} (${course.difficulty}) - ${course.quizzes.length} quizzes`);
    });

    console.log(`\n🎉 Total courses inserted: ${insertedCourses.length}`);
    
  } catch (error) {
    console.error('❌ Error seeding courses:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the seed function
seedCourses();
