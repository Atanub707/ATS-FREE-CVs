import { CandidateProfile } from './storage/fileStorage.js';

export function buildProfileText(profile: CandidateProfile): string {
  const line = (label: string, value: string) => (value ? `${label}: ${value}` : '');
  return [
    line('Notice period', profile.noticePeriod),
    line('Available from', profile.availableFrom),
    line('Work mode preference', profile.workModes.join(', ')),
    line('Preferred locations', profile.preferredLocations.join(', ')),
    line('Employment type preference', profile.employmentTypes.join(', ')),
    line('Job search status', profile.jobSearchStatus),
    line('Years of experience', profile.yearsExperience),
    profile.recruiterNote ? `Recruiter note: ${profile.recruiterNote}` : '',
  ].filter(Boolean).join('\n');
}
