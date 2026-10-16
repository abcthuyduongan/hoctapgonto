// Test-only browser entry. Vite bundles the production adapter without exposing
// a test hook from the application's own entry point or replacing IndexedDB.
export { storage, openLearningDatabase } from '../../../src/core/storage';
export { tabOwnerId, acquireSessionOwnership, recoverOrphanedLessons } from '../../../src/core/session-manager';
