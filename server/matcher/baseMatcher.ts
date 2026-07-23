import { Job, MasterCv, GapAnalysis } from '../../src/types.js';

export interface MatchResult {
  matchScore: number;
  gapAnalysis: GapAnalysis;
  isEarlyBlocked: boolean;
}

export abstract class BaseMatcher {
  abstract matchJob(job: Job, masterCv: MasterCv, earlyBlockThreshold?: number): Promise<MatchResult>;
}
