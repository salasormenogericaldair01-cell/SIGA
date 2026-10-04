import run, { profile, handleSummary } from './read-only.js';
export const options = profile(1, '30s');
options.stages = [
  { duration: '10s', target: 10 }, { duration: '1m', target: 10 },
  { duration: '10s', target: 20 }, { duration: '1m', target: 20 },
  { duration: '10s', target: 30 }, { duration: '1m', target: 30 },
  { duration: '10s', target: 0 },
];
delete options.vus;
delete options.duration;
export { handleSummary };
export default run;
