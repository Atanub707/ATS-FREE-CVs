import { Job, MasterCv, TailoredCv } from '../../src/types.js';

export abstract class BaseCvBuilder {
  abstract tailorCv(job: Job, masterCv: MasterCv): Promise<TailoredCv>;
}
