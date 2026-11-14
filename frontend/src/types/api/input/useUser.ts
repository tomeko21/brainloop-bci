/** GET /api/users/{subjectName} */
export interface UserProfileInput {
  subjectName: string;
}

/** GET /api/users/{subjectName}/stats */
export interface UserStatsInput {
  subjectName: string;
}
