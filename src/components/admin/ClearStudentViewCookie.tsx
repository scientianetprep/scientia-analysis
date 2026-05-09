"use client";

import { useEffect } from "react";

export function ClearStudentViewCookie() {
  useEffect(() => {
    document.cookie = "force_student_view=; path=/; max-age=0";
  }, []);
  return null;
}