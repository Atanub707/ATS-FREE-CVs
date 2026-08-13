import { describe, it, expect } from 'vitest';
import { buildProfileText } from '../../server/emailProfile';
import { CandidateProfile } from '../../server/storage/fileStorage';

const filled: CandidateProfile = {
  workModes: ['remote', 'hybrid'],
  preferredLocations: ['Kolkata, West Bengal, India', 'Bengaluru, Karnataka, India'],
  noticePeriod: '30 days',
  availableFrom: '2026-09-01',
  employmentTypes: ['full-time', 'contract'],
  yearsExperience: '7+ years',
  currentRole: 'Senior Engineer',
  currentCompany: 'ACME',
  currentSalary: '14,00,000',
  expectedSalaryMin: '12,00,000',
  expectedSalaryMax: '18,00,000',
  salaryCurrency: 'INR',
  jobSearchStatus: 'Actively looking',
  willingToRelocate: 'yes',
  willingToTravelPct: '25',
  workAuthorization: 'Citizen',
  needsSponsorship: false,
  languages: ['English', 'Hindi'],
  preferredCompanySize: 'Mid-size (51–500)',
  recruiterNote: 'Open to contract-to-hire.',
};

const empty: CandidateProfile = {
  workModes: [], preferredLocations: [], noticePeriod: '', availableFrom: '',
  employmentTypes: [], yearsExperience: '', currentRole: '', currentCompany: '',
  currentSalary: '', expectedSalaryMin: '', expectedSalaryMax: '', salaryCurrency: '',
  jobSearchStatus: '', willingToRelocate: 'no', willingToTravelPct: '',
  workAuthorization: '', needsSponsorship: false, languages: [],
  preferredCompanySize: '', recruiterNote: '',
};

describe('buildProfileText', () => {
  it('builds the 8 preference lines from a filled profile', () => {
    const text = buildProfileText(filled);
    const lines = text.split('\n');
    expect(lines).toHaveLength(8);
    expect(lines[0]).toBe('Notice period: 30 days');
    expect(lines[1]).toBe('Available from: 2026-09-01');
    expect(lines[2]).toBe('Work mode preference: remote, hybrid');
    expect(lines[3]).toBe('Preferred locations: Kolkata, West Bengal, India, Bengaluru, Karnataka, India');
    expect(lines[4]).toBe('Employment type preference: full-time, contract');
    expect(lines[5]).toBe('Job search status: Actively looking');
    expect(lines[6]).toBe('Years of experience: 7+ years');
    expect(lines[7]).toBe('Recruiter note: Open to contract-to-hire.');
  });

  it('returns an empty string for an empty profile', () => {
    expect(buildProfileText(empty)).toBe('');
  });

  it('never leaks compensation into the draft text', () => {
    const text = buildProfileText(filled);
    expect(text).not.toContain('14,00,000');
    expect(text).not.toContain('12,00,000');
    expect(text).not.toContain('18,00,000');
    expect(text).not.toContain('INR');
    expect(text.toLowerCase()).not.toContain('salary');
    expect(text.toLowerCase()).not.toContain('current');
    expect(text.toLowerCase()).not.toContain('expected');
  });
});
