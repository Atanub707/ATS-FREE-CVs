import React, { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

// Guided onboarding tour — highlights real UI elements via CSS selectors
// (driver.js spotlight + tooltips). Runs automatically on the first login,
// and can be replayed any time from the account menu / Settings.

const TOUR_FLAG = 'tailor_tour_seen_v1';

export function startTour(): void {
  const d = driver({
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    steps: [
      {
        element: '#input-scrape-keywords',
        popover: {
          title: 'Search jobs from 19 sources',
          description: 'Type a role (e.g. "DevOps Engineer") and press <b>Search Jobs</b> — live postings come in from LinkedIn, Indeed, Naukri, Glassdoor, Upwork and more.',
          side: 'bottom',
        },
      },
      {
        element: '#btn-scrape-submit',
        popover: {
          title: 'One search, many boards',
          description: 'Every search runs your keywords across the selected sources at once — with filters for Remote/Hybrid/On-site, posting window, level and contract.',
          side: 'bottom',
        },
      },
      {
        element: 'button[title*="LinkedIn — Global"]',
        popover: {
          title: 'Pick your sources',
          description: 'Each chip is a job source. Apify-powered sources (LinkedIn, Indeed, Naukri, Glassdoor, Upwork) work with your Apify key; built-in sources are free.',
          side: 'bottom',
        },
      },
      {
        element: 'button[title*="recruiting emails"]',
        popover: {
          title: 'Recruiters, automatically found',
          description: 'Recruiter names, emails, phones and LinkedIn profiles are extracted from every job description — and you can send them cold emails from your own mailbox.',
          side: 'bottom',
        },
      },
      {
        element: 'button[aria-haspopup="menu"]',
        popover: {
          title: 'Everything lives here',
          description: 'The account menu holds your <b>Master Candidate CV</b>, <b>Manual JD</b> (paste any job description → instant ATS analysis + tailored CV), <b>Settings</b> (LLM, Apify, SMTP keys) and more.',
          side: 'bottom',
        },
      },
      {
        popover: {
          title: 'You are set 🎉',
          description: 'Score any job against your CV, tailor it in one click, download ATS-safe PDFs in your template — and take the tour again anytime from Settings.',
          side: 'top',
        },
      },
    ],
    onDestroyed: () => localStorage.setItem(TOUR_FLAG, '1'),
  });
  d.drive();
}

function shouldShowTour(): boolean {
  return localStorage.getItem(TOUR_FLAG) !== '1';
}

// Auto-run once after the app shell is ready (post-login).
export const OnboardingTour: React.FC<{ ready?: boolean }> = ({ ready = false }) => {
  const started = useRef(false);
  useEffect(() => {
    if (!ready) return; // wait for the logged-in UI (search bar) to exist
    if (started.current) return;
    if (!shouldShowTour()) return;
    started.current = true;
    const t = setTimeout(() => {
      if (document.getElementById('input-scrape-keywords')) {
        startTour();
      }
    }, 900);
    return () => clearTimeout(t);
  }, [ready]);
  return null;
};
