/**
 * Centralized cache invalidation utilities
 *
 * Use these functions in Server Actions and API routes to bust cached data.
 * This prevents having scattered revalidatePath/revalidateTag calls.
 */

import { revalidateTag } from "next/cache";

export function invalidateCourses(courseId?: string) {
  if (courseId) {
    revalidateTag(`course-${courseId}`);
  }
  revalidateTag("courses");
}

export function invalidateUserCourses(userId: string) {
  revalidateTag(`user-courses-${userId}`);
  revalidateTag("courses");
}

export function invalidateTests(testId?: string) {
  if (testId) {
    revalidateTag(`test-${testId}`);
  }
  revalidateTag("tests");
}

export function invalidateQuestions(questionId?: string) {
  if (questionId) {
    revalidateTag(`question-${questionId}`);
  }
  revalidateTag("questions");
}

export function invalidateUsers(userId?: string) {
  if (userId) {
    revalidateTag(`user-${userId}`);
  }
  revalidateTag("users");
}
