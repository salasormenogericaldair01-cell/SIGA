import run, { profile, handleSummary } from './read-only.js';
export const options = profile(10, '3m');
export { handleSummary };
export default run;
