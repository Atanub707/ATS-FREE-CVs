import { initDbWithPath, resetDbForTests } from '../../server/storage/fileStorage';

export function setupTestDb(): void {
  initDbWithPath(':memory:');
}

export function teardownTestDb(): void {
  resetDbForTests();
}
